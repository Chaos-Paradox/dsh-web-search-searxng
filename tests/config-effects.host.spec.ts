/** Field ownership must restore arbitrary pre-install routing without overwriting later edits. */
import { describe, expect, it } from 'vitest'
import { configEffectDocument, reconcileConfigEffects, recordConfigEffectWrite, type BundleConfigEffect } from '../host-integration/config-effects.ts'

const owner = 'dsh-web-search-searxng'
const active: { owner: string; effects: BundleConfigEffect[] }[] = [{ owner, effects: [
  { id: 'web', set: { searchProvider: 'searxng' } },
  { id: 'web-search-searxng', set: { allowOfficialFallback: false }, track: ['baseURL', 'engines', 'language', 'allowOfficialFallback'] },
] }]
const inherited = new Map<string, Record<string, unknown>>([
  ['web', { searchProvider: 'deepseek-official', fetchProvider: 'http' }],
  ['web-search-searxng', {}],
])
const data = (text: string) => configEffectDocument(text).toJS()
function install(text: string) {
  const document = configEffectDocument(text)
  reconcileConfigEffects(document, active, inherited)
  return String(document)
}
function uninstall(text: string) {
  const document = configEffectDocument(text)
  const conflicts = reconcileConfigEffects(document, [], inherited)
  return { text: String(document), conflicts }
}

describe('bundle configuration change journal', () => {
  it.each([
    '[]\n',
    '- id: web\n  config:\n    searchProvider: my-original-provider\n    fetchProvider: custom-fetch\n',
    '- id: web\n  config:\n    fetchProvider: custom-fetch\n',
    '- id: web\n  config: {}\n',
    '- id: web-search-searxng\n  config:\n    allowOfficialFallback: true\n    engines: old-engine\n',
  ])('restores pre-install field values and absence: %s', original => {
    const installed = install(original)
    const document = configEffectDocument(installed)
    const rows = document.toJS() as { id: string; config: Record<string, unknown> }[]
    expect(rows.find(row => row.id === 'web')?.config.searchProvider).toBe('searxng')
    expect(rows.find(row => row.id === 'web-search-searxng')?.config.allowOfficialFallback).toBe(false)
    const removed = uninstall(installed)
    expect(removed.conflicts).toEqual([])
    expect(data(removed.text)).toEqual(data(original))
    expect(removed.text).not.toContain('dsh-config-effects/v1')
  })

  it('restores settings changed through the card and does not materialize extra inherited fields', () => {
    const document = configEffectDocument(install('[]\n'))
    const index = (document.toJS() as { id: string }[]).findIndex(row => row.id === 'web-search-searxng')
    const before = (document.toJS() as { config: Record<string, unknown> }[])[index]!.config
    document.setIn([index, 'config', 'baseURL'], 'http://localhost:8080')
    document.setIn([index, 'config', 'allowOfficialFallback'], true)
    recordConfigEffectWrite(document, 'web-search-searxng', before)
    expect(data(uninstall(String(document)).text)).toEqual([])
  })

  it('preserves a later manual route and restores unrelated owned fields', () => {
    const document = configEffectDocument(install('[]\n'))
    document.setIn([0, 'config', 'searchProvider'], 'user-later-provider')
    const removed = uninstall(String(document))
    expect(removed.conflicts).toEqual([`${owner}: web.searchProvider changed outside the bundle; retained`])
    expect(data(removed.text)).toEqual([{ id: 'web', config: { searchProvider: 'user-later-provider' } }])
  })

  it('preserves an unrelated fetch edit but still removes the owned SearXNG route', () => {
    const document = configEffectDocument(install('[]\n'))
    const before = { searchProvider: 'searxng', fetchProvider: 'http' }
    document.setIn([0, 'config', 'fetchProvider'], 'user-fetch')
    recordConfigEffectWrite(document, 'web', before)
    const removed = uninstall(String(document))
    expect(removed.conflicts).toHaveLength(1)
    expect(data(removed.text)).toEqual([{ id: 'web', config: { fetchProvider: 'user-fetch' } }])
  })

  it('does not claim later manual settings changes', () => {
    const document = configEffectDocument(install('[]\n'))
    document.setIn([1, 'config', 'baseURL'], 'http://manual.test')
    const before = { baseURL: 'http://manual.test', allowOfficialFallback: false }
    document.setIn([1, 'config', 'allowOfficialFallback'], true)
    recordConfigEffectWrite(document, 'web-search-searxng', before)
    const removed = uninstall(String(document))
    expect(removed.conflicts).toHaveLength(1)
    expect(data(removed.text)).toEqual([{ id: 'web-search-searxng', config: { baseURL: 'http://manual.test' } }])
  })

  it('keeps the original baseline across updates, restarts, and repeated reconciliation', () => {
    const original = '- id: web\n  config:\n    searchProvider: custom\n'
    const installed = install(original)
    expect(install(installed)).toBe(installed)
    expect(data(uninstall(install(installed)).text)).toEqual(data(original))
  })

  it('retains comments, !!js values and row metadata', () => {
    const original = '# user comment\n- id: web\n  disabled: false\n  config:\n    searchProvider: !!js env.SEARCH_PROVIDER\n    fetchProvider: custom\n- id: untouched\n  disabled: true\n'
    const removed = uninstall(install(original))
    expect(removed.conflicts).toEqual([])
    expect(data(removed.text)).toEqual(data(original))
    expect(removed.text).toContain('user comment')
    expect(removed.text).toContain('!!js')
  })

  it('rejects ambiguous duplicate overrides and corrupted ownership records', () => {
    expect(() => install('- id: web\n  config: {}\n- id: web\n  config: {}\n')).toThrow('Multiple profile config overrides')
    expect(() => uninstall('#dsh-config-effects/v1: {"bad":true}\n\n[]\n')).toThrow('Invalid bundle configuration journal')
  })
})
