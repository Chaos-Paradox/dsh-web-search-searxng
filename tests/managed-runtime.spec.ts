import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SubprocessHandle, SubprocessOutcome, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { ManagedRuntime } from '../src/managed-runtime.ts'
import type { PreparedRuntime } from '../src/runtime-installer.ts'

const directories: string[] = []
const managers: ManagedRuntime[] = []
const options = { port: 0, setupTimeoutMs: 3000, startupTimeoutMs: 2000, restartLimit: 1 }
afterEach(async () => { for (const m of managers.splice(0)) await m.dispose(); for (const d of directories.splice(0)) await rm(d, { recursive: true, force: true }); vi.unstubAllGlobals() })

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'searxng-managed-')); directories.push(dir)
  const children: (SubprocessHandle & { exit: () => void; terminated: boolean })[] = []
  const spawn = vi.fn((_spec: SubprocessSpawnSpec) => {
    let resolve!: (value: SubprocessOutcome) => void
    const done = new Promise<SubprocessOutcome>(r => { resolve = r })
    const child = {
      stdin: undefined, stdout: undefined, stderr: undefined, control: undefined,
      collected: { stdout: { readFrom: () => ({ text: 'DSH_SEARXNG_READY {"port":12345}\n', nextOffset: 40, lossy: false }) } },
      done, terminated: false,
      terminate() { this.terminated = true; resolve({ exitCode: null, signal: 'SIGTERM' }) },
      async waitForExit() { await done; return true },
      exit() { resolve({ exitCode: 1, signal: null }) },
    }
    children.push(child)
    return child
  })
  const prepare = vi.fn(async (): Promise<PreparedRuntime> => ({ python: 'managed-python', source: dir }))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ engines: [] }))))
  const manager = new ManagedRuntime(dir, { spawn }, prepare)
  managers.push(manager)
  return { dir, manager, spawn, prepare, children }
}

describe('managed service lifecycle', () => {
  it('waits for readiness and stops only its owned handle, leaving the cache reusable', async () => {
    const f = await fixture()
    await f.manager.start(options)
    expect(f.manager.status()).toMatchObject({ phase: 'ready', endpoint: 'http://127.0.0.1:12345' })
    expect(f.spawn.mock.calls[0]![0].argv.at(-1)).toBe('0')
    await f.manager.stop()
    expect(f.children[0]!.terminated).toBe(true)
    expect(f.manager.status().phase).toBe('stopped')
    await f.manager.start({ ...options, port: 23456 })
    expect(f.spawn.mock.calls[1]![0].argv.at(-1)).toBe('23456')
  })

  it('rejects a second profile owner without spawning a duplicate service', async () => {
    const f = await fixture(); await f.manager.start(options)
    const duplicate = new ManagedRuntime(f.dir, { spawn: f.spawn }, f.prepare); managers.push(duplicate)
    await duplicate.start(options)
    expect(duplicate.status().phase).toBe('failed')
    expect(f.spawn).toHaveBeenCalledTimes(1)
    expect(f.manager.status().phase).toBe('ready')
  })

  it('bounds crash recovery and leaves a visible failure after repeated exits', async () => {
    const f = await fixture(); await f.manager.start(options)
    f.children[0]!.exit()
    await vi.waitFor(() => expect(f.children).toHaveLength(2))
    await vi.waitFor(() => expect(f.manager.status().phase).toBe('ready'))
    f.children[1]!.exit()
    await vi.waitFor(() => expect(f.manager.status().phase).toBe('failed'))
    expect(f.children).toHaveLength(2)
  })

  it('cancels an in-progress installation and releases ownership', async () => {
    const f = await fixture()
    const waiting = new ManagedRuntime(f.dir, { spawn: f.spawn }, async (_dir, _command, signal) => {
      await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
      throw new Error('unreachable')
    }); managers.push(waiting)
    const start = waiting.start(options)
    await vi.waitFor(() => expect(waiting.status().phase).toBe('preparing'))
    await new Promise(r => setTimeout(r, 20))
    await waiting.stop(); await start
    expect(waiting.status().phase).toBe('stopped')
    await f.manager.start(options)
    expect(f.manager.status().phase).toBe('ready')
  })

  it('cleans up failed readiness and permits retry without an orphan process', async () => {
    const f = await fixture()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
    await f.manager.start({ ...options, startupTimeoutMs: 50 })
    expect(f.manager.status().phase).toBe('failed')
    expect(f.children[0]!.terminated).toBe(true)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"engines":[]}')))
    await f.manager.start(options)
    expect(f.manager.status().phase).toBe('ready')
  })
})
