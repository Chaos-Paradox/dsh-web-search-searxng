/** Profile-owned SearXNG lifecycle using public DSH subprocess handles. */
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import lockfile from 'proper-lockfile'
import type { SubprocessRuntime, SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import { prepareRuntime, type PreparedRuntime, type RuntimeCommand } from './runtime-installer.ts'
import type { ServiceStatus } from './runtime-types.ts'

export interface ManagedOptions {
  port: number
  setupTimeoutMs: number
  startupTimeoutMs: number
  restartLimit: number
}

const SERVER = `import socket, sys, json, os
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(('127.0.0.1', int(sys.argv[1])))
sock.listen(128)
from searx.webapp import app
from waitress import serve
print('DSH_SEARXNG_READY ' + json.dumps({'port': sock.getsockname()[1]}), flush=True)
serve(app, sockets=[sock], threads=4)
`

/** One manager owns one profile lock, subprocess range, and bounded log. */
export class ManagedRuntime {
  private state: ServiceStatus = { phase: 'idle', endpoint: '', message: '', logs: '' }
  private controller: AbortController | undefined
  private operation: Promise<void> = Promise.resolve()
  private child: SubprocessHandle | undefined
  private release: (() => Promise<void>) | undefined
  private disposed = false
  private options: ManagedOptions | undefined
  private attempts = 0

  constructor(
    private readonly directory: string,
    private readonly subprocess: Pick<SubprocessRuntime, 'spawn'>,
    private readonly prepare = prepareRuntime,
  ) {}

  /** Current immutable snapshot, including recent child output. */
  status(): ServiceStatus {
    const output = this.child ? this.output(this.child) : ''
    return { ...this.state, logs: `${this.state.logs}\n${output}`.trim().slice(-12000) }
  }

  /** Serialize configuration changes, cancelling preparation or startup already in progress. */
  start(options: ManagedOptions): Promise<void> {
    this.options = options
    this.attempts = 0
    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller
    this.operation = this.operation.catch(() => {}).then(async () => {
      await this.stopChild()
      if (this.disposed || controller.signal.aborted) return
      try { await this.launch(options, controller.signal) }
      catch (error) {
        await this.stopChild()
        if (!controller.signal.aborted) this.state = { ...this.state, phase: 'failed', endpoint: '', message: error instanceof Error ? error.message : String(error) }
      }
    })
    return this.operation
  }

  /** Stop only this manager's process; the cached runtime and preferences remain. */
  stop(): Promise<void> {
    this.options = undefined
    this.controller?.abort()
    this.operation = this.operation.catch(() => {}).then(async () => {
      await this.stopChild()
      this.state = { ...this.state, phase: 'stopped', endpoint: '', message: '' }
    })
    return this.operation
  }

  /** Cancel setup and await complete subprocess teardown before releasing ownership. */
  async dispose(): Promise<void> {
    this.disposed = true
    await this.stop()
  }

  private output(child: SubprocessHandle): string {
    return [child.collected.stdout?.readFrom(0).text, child.collected.stderr?.readFrom(0).text].filter(Boolean).join('\n').slice(-12000)
  }

  private spawn(argv: string[], cwd: string, env: Record<string, string>, signal: AbortSignal): SubprocessHandle {
    return this.subprocess.spawn({ argv, cwd, env, signal, graceMs: 3000,
      stdio: { stdin: 'ignore', stdout: { maxBytes: 16000 }, stderr: { maxBytes: 16000 } } })
  }

  private async launch(options: ManagedOptions, signal: AbortSignal): Promise<void> {
    this.state = { phase: 'preparing', endpoint: '', message: '', logs: '' }
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    this.release = await lockfile.lock(this.directory, { realpath: false, stale: 60000, update: 10000,
      onCompromised: error => { this.state = { ...this.state, phase: 'failed', message: error.message }; this.controller?.abort() } })
    const setupSignal = AbortSignal.any([signal, AbortSignal.timeout(options.setupTimeoutMs)])
    const command: RuntimeCommand = async (argv, cwd, env, commandSignal) => {
      const child = this.spawn(argv, cwd, env, commandSignal)
      this.child = child
      try {
        const result = await child.done
        this.state.logs = `${this.state.logs}\n${this.output(child)}`.slice(-12000)
        commandSignal.throwIfAborted()
        if (result.exitCode !== 0) throw new Error(`Runtime setup failed (${result.exitCode}): ${this.output(child)}`)
      } finally {
        child.terminate()
        await child.waitForExit()
        if (this.child === child) this.child = undefined
      }
    }
    const runtime: PreparedRuntime = await this.prepare(this.directory, command, setupSignal, message => { this.state.message = message })
    signal.throwIfAborted()
    const secretPath = join(this.directory, 'secret')
    let secret: string
    try { secret = await readFile(secretPath, 'utf8') }
    catch { secret = randomBytes(32).toString('hex'); await writeFile(secretPath, secret, { mode: 0o600 }) }
    const settings = join(this.directory, 'settings.yml')
    await writeFile(settings, `use_default_settings: true\nserver:\n  secret_key: ${JSON.stringify(secret)}\n  bind_address: 127.0.0.1\n  limiter: false\nsearch:\n  formats: [html, json]\n`, { mode: 0o600 })
    const script = join(this.directory, 'serve.py')
    await writeFile(script, SERVER)
    this.state = { ...this.state, phase: 'starting', message: '' }
    const child = this.spawn([runtime.python, '-u', script, String(options.port)], runtime.source,
      { SEARXNG_SETTINGS_PATH: settings, PYTHONPATH: runtime.source, PYTHONUNBUFFERED: '1' }, signal)
    this.child = child
    let exited = false
    let failure = ''
    const onExit = (reason: string) => {
      exited = true
      failure = reason
      if (this.child === child && this.state.phase === 'ready' && !signal.aborted && !this.disposed) {
        this.state = { ...this.state, phase: 'failed', endpoint: '', message: failure }
        if (this.options && this.attempts++ < this.options.restartLimit) this.restartAfterExit(this.options)
      }
    }
    void child.done.then(result => { onExit(`SearXNG exited (${result.exitCode}): ${this.output(child)}`) }, error => { onExit(String(error)) })
    const startupSignal = AbortSignal.any([signal, AbortSignal.timeout(options.startupTimeoutMs)])
    while (true) {
      startupSignal.throwIfAborted()
      if (exited) throw new Error(failure)
      const line = child.collected.stdout?.readFrom(0).text.match(/DSH_SEARXNG_READY (\{[^\n]+\})/)
      if (line) {
        const port = JSON.parse(line[1]!).port
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid managed SearXNG port')
        const endpoint = `http://127.0.0.1:${port}`
        try {
          const health = await fetch(`${endpoint}/config`, { redirect: 'error', signal: AbortSignal.any([startupSignal, AbortSignal.timeout(1500)]) })
          const config: unknown = await health.json()
          if (health.ok && typeof config === 'object' && config !== null && Array.isArray(Reflect.get(config, 'engines'))) {
            this.state = { ...this.state, phase: 'ready', endpoint, message: '' }
            return
          }
        } catch { startupSignal.throwIfAborted() }
      }
      await delay(250, undefined, { signal: startupSignal })
    }
  }

  private restartAfterExit(options: ManagedOptions): void {
    this.operation = this.operation.catch(() => {}).then(async () => {
      await this.stopChild()
      if (this.disposed || this.options !== options) return
      this.controller = new AbortController()
      try { await this.launch(options, this.controller.signal) }
      catch (error) { await this.stopChild(); this.state = { ...this.state, phase: 'failed', endpoint: '', message: String(error) } }
    })
  }

  private async stopChild(): Promise<void> {
    const child = this.child
    this.child = undefined
    if (child) { this.state.logs = `${this.state.logs}\n${this.output(child)}`.slice(-12000); child.terminate(); await child.waitForExit() }
    const release = this.release
    this.release = undefined
    await release?.()
  }
}
