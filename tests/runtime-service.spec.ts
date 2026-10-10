import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SearxngSearchProvider } from '../src/provider.ts'
import { SearxngRuntimeService } from '../src/runtime-service.ts'
import type { ServiceOptions } from '../src/runtime-service.ts'

const managed = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), dispose: vi.fn() }))
vi.mock('../src/managed-runtime.ts', () => ({ ManagedRuntime: class {
  start = managed.start
  stop = managed.stop
  dispose = managed.dispose
  status() { return { phase: 'ready', endpoint: 'http://127.0.0.1:12345', message: '', logs: '' } }
} }))

const options: ServiceOptions = { mode: 'local', externalURL: '', port: 0, setupTimeoutMs: 3000, startupTimeoutMs: 1000, restartLimit: 2 }
const provider = () => new SearxngSearchProvider(() => ({ baseURL: '' }))

describe('runtime dependency ordering', () => {
  it('automatically starts when the process service mounts after the plugin', async () => {
    vi.clearAllMocks()
    const ctx = new Context()
    ctx.provide('profileContext', { dir: '/tmp/test-profile' } as Context['profileContext'])
    await ctx.plugin(ctx => { const service = new SearxngRuntimeService(ctx, () => options, provider()); service.sync() })
    expect(ctx.searxngRuntime.status().phase).toBe('idle')
    expect(managed.start).not.toHaveBeenCalled()
    const processes = await ctx.plugin(ctx => { ctx.provide('subprocess', { spawn: vi.fn() } as unknown as Context['subprocess']) })
    await vi.waitFor(() => expect(managed.start).toHaveBeenCalledTimes(1))
    expect(ctx.searxngRuntime.endpoint()).toBe('http://127.0.0.1:12345')
    await processes.dispose()
    await vi.waitFor(() => expect(managed.dispose).toHaveBeenCalledTimes(1))
    expect(ctx.searxngRuntime.endpoint()).toBe('')
    await ctx.plugin(ctx => { ctx.provide('subprocess', { spawn: vi.fn() } as unknown as Context['subprocess']) })
    await vi.waitFor(() => expect(managed.start).toHaveBeenCalledTimes(2))
    await ctx.fiber.dispose()
  })

  it('uses an existing endpoint without waiting for a process service', async () => {
    vi.clearAllMocks()
    const ctx = new Context()
    await ctx.plugin(ctx => {
      const service = new SearxngRuntimeService(ctx, () => ({ ...options, mode: 'auto', externalURL: 'http://existing.test' }), provider())
      service.sync()
    })
    expect(ctx.searxngRuntime.status()).toMatchObject({ phase: 'external', endpoint: 'http://existing.test' })
    expect(managed.start).not.toHaveBeenCalled()
    await ctx.fiber.dispose()
  })
})
