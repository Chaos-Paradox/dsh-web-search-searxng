import { describe, expect, it, vi } from 'vitest'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import { stubConfigForm, type StubConfigForm } from './helpers.ts'
import { SearxngSearchCardController, type SearxngSearchSettings } from '../src/client/searxng-search-card-controller.ts'

/** Make the stub behave like a Host that accepts every write. */
function acceptWrites<T>(host: StubConfigForm<T>): void {
  const section = (): Record<string, unknown> => ({ ...host.scope.getSnapshot().value as object })
  const layer = (): Record<string, unknown> => ({ ...host.scope.getSnapshot().user as object })
  host.set.mockImplementation((field: string, value: unknown) => {
    host.publish({ value: { ...section(), [field]: value } as T, user: { ...layer(), [field]: value } })
  })
  host.mutate.mockImplementation((ops: readonly SettingsPathOpView[]) => {
    const value = { ...section() }
    const user = { ...layer() }
    for (const op of ops) {
      const field = op.path[0]!
      if (op.op === 'set') {
        value[field] = op.value
        user[field] = op.value
      } else {
        Reflect.deleteProperty(user, field)
        value[field] = (host.scope.getSnapshot().base as Record<string, unknown> | undefined)?.[field]
      }
    }
    host.publish({ value: value as T, user })
    return Promise.resolve(true)
  })
  host.unset.mockImplementation((field: string) => {
    const user = Object.fromEntries(Object.entries(layer()).filter(([key]) => key !== field))
    const base = host.scope.getSnapshot().base as Record<string, unknown> | undefined
    host.publish({ value: { ...section(), [field]: base?.[field] } as T, user })
  })
}

describe('SearxngSearchCardController', () => {
  it('projects the served section into field state', () => {
    const host = stubConfigForm<SearxngSearchSettings>()
    const controller = new SearxngSearchCardController(host.scope)
    host.publish({ status: 'ready', writable: true, value: { baseURL: 'http://localhost:8080' }, user: {} })

    const state = controller.inject().hooks.searxngSearchCard.getSnapshot()
    expect(state).toMatchObject({
      available: true,
      baseURL: { text: 'http://localhost:8080', overridden: false },
      engines: { text: '', overridden: false },
      language: { text: '', overridden: false },
    })
  })

  it('saves the endpoint, engines, and language together', async () => {
    const host = stubConfigForm<SearxngSearchSettings>()
    acceptWrites(host)
    const controller = new SearxngSearchCardController(host.scope)
    host.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
    const face = controller.inject()

    face.edit('baseURL', 'http://searxng.internal')
    face.edit('engines', 'bing,duckduckgo')
    face.edit('language', 'zh-CN')
    expect(face.hooks.searxngSearchCard.getSnapshot().dirty).toBe(true)
    face.save()
    await vi.waitFor(() => { expect(host.mutate).toHaveBeenCalledTimes(1) })

    expect(host.mutate.mock.calls.map(([ops]) => ops)).toEqual([
      [['baseURL', 'http://searxng.internal'], ['engines', 'bing,duckduckgo'], ['language', 'zh-CN']]
        .map(([field, value]) => ({ op: 'set', path: [field], value })),
    ])
  })

  it('stages a reset back to the composition layer', async () => {
    const host = stubConfigForm<SearxngSearchSettings>()
    acceptWrites(host)
    const controller = new SearxngSearchCardController(host.scope)
    host.publish({
      status: 'ready', writable: true,
      value: { engines: 'bing' }, base: {}, user: { engines: 'bing' },
    })
    const face = controller.inject()

    face.resetField('engines')
    face.save()
    await vi.waitFor(() => { expect(host.mutate).toHaveBeenCalledTimes(1) })

    expect(host.mutate.mock.calls.map(([ops]) => ops)).toEqual([[{ op: 'unset', path: ['engines'] }]])
    await vi.waitFor(() => {
      expect(face.hooks.searxngSearchCard.getSnapshot().engines).toMatchObject({ text: '', overridden: false })
    })
  })
})
