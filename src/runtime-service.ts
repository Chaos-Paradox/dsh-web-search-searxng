/** Authenticated card controls and profile-scoped managed service selection. */
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-subprocess'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { ManagedRuntime } from './managed-runtime.ts'
import type { ManagedOptions } from './managed-runtime.ts'
import type { ServiceMode, ServiceStatus } from './runtime-types.ts'
import type { SearxngSearchProvider } from './provider.ts'

export interface ServiceOptions extends ManagedOptions { mode: ServiceMode; externalURL: string }

declare module '@deepseek-ai/cordis' {
  interface Context { searxngRuntime: SearxngRuntimeService }
}

/** Controls are operator RPCs, never model tools. External services are never stopped. */
export class SearxngRuntimeService extends TypertRemoteService {
  private manager: ManagedRuntime | undefined
  private key = ''
  private local = false
  private error = ''
  private disposed = false
  private subprocess: SubprocessRuntime | undefined

  constructor(ctx: Context, private readonly options: () => ServiceOptions, private readonly provider: SearxngSearchProvider) {
    super(ctx, 'searxngRuntime')
    ctx.effect(() => async () => { this.disposed = true; await this.manager?.dispose() }, 'SearXNG owned process')
    // Bundle rows mount concurrently. Wait for the public service to become
    // active, and dispose its consumer before a replacement process service.
    ctx.inject(['subprocess'], ctx => {
      this.subprocess = ctx.subprocess
      this.key = ''
      this.sync()
      ctx.effect(() => async () => {
        const manager = this.manager
        this.manager = undefined
        this.subprocess = undefined
        this.key = ''
        await manager?.dispose()
      }, 'SearXNG subprocess dependency')
    })
  }

  /** Reconcile only service settings; engine/language writes do not restart the process. */
  sync(force = false): void {
    if (this.disposed) return
    const options = this.options()
    const local = options.mode === 'local' || options.mode === 'auto' && !options.externalURL.trim()
    const key = JSON.stringify({ local, port: options.port, setupTimeoutMs: options.setupTimeoutMs,
      startupTimeoutMs: options.startupTimeoutMs, restartLimit: options.restartLimit })
    if (!force && key === this.key) return
    this.key = key
    this.local = local
    this.error = ''
    if (!local) { void this.manager?.stop(); return }
    if (!this.manager) {
      const profile = this.ctx.get('profileContext')
      if (!profile) {
        this.error = 'Local management requires a DSH profile; configure an external instance instead'
        return
      }
      if (!this.subprocess) return
      this.manager = new ManagedRuntime(join(profile.dir, 'searxng'), this.subprocess)
    }
    void this.manager.start(options)
  }

  /** Only a ready owned service may supply a managed endpoint. */
  endpoint(): string {
    if (!this.local) return this.options().externalURL
    const status = this.manager?.status()
    return status?.phase === 'ready' ? status.endpoint : ''
  }

  /** Return setup, readiness and bounded diagnostic output to the operator card. */
  @Remote
  status(): ServiceStatus {
    if (!this.local) return { phase: 'external', endpoint: this.options().externalURL, message: '', logs: '' }
    if (this.error) return { phase: 'failed', endpoint: '', message: this.error, logs: '' }
    return this.manager?.status() ?? { phase: 'idle', endpoint: '', message: 'Waiting for the DSH subprocess service', logs: '' }
  }

  /** Retry failed setup or restart this plugin's local service, preserving configuration. */
  @Remote
  restart(): ServiceStatus {
    this.sync(true)
    return this.status()
  }

  /** Stop this plugin's local process; external instances are unaffected. */
  @Remote
  async stop(): Promise<ServiceStatus> {
    if (this.local) await this.manager?.stop()
    return this.status()
  }

  /** Test the selected SearXNG endpoint without invoking official fallback. */
  @Remote
  async test(signal: AbortSignal): Promise<number> {
    const result = await this.provider.search({ query: 'SearXNG', maxResults: 3 }, signal)
    return result.sources.length
  }
}
