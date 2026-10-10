/** Live service status and operator actions over the authenticated DSH carrier. */
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ServiceStatus } from '../runtime-types.ts'
import type { SearxngSearchCardFace } from './searxng-search-card-controller.ts'
import type { SearxngSearchSettingsLocaleKey } from './locales.ts'

const labels = { idle: 'serviceIdle', preparing: 'servicePreparing', starting: 'serviceStarting', ready: 'serviceReady',
  stopped: 'serviceStopped', failed: 'serviceFailed', external: 'serviceExternal' } as const
const stages = { uv: 'setupUv', source: 'setupSource', python: 'setupPython', dependencies: 'setupDependencies' } as const

export function ServicePanel({ call, t, writable }: {
  call: SearxngSearchCardFace['serviceCall']; writable: boolean; t: (key: SearxngSearchSettingsLocaleKey) => string
}) {
  const [status, setStatus] = useState<ServiceStatus>({ phase: 'idle', endpoint: '', message: '', logs: '' })
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [testing, setTesting] = useState<number | undefined>()
  const [busy, setBusy] = useState(false)
  const lifetime = useRef<AbortController | undefined>(undefined)
  useEffect(() => {
    if (!call) return
    const controller = new AbortController()
    lifetime.current = controller
    setBusy(false)
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try {
        const next = await call('status', AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]))
        if (!controller.signal.aborted && typeof next !== 'number') { setStatus(next); setPollError('') }
      } catch (e) { if (!controller.signal.aborted) setPollError(String(e)) }
      if (!controller.signal.aborted) timer = setTimeout(() => { void poll() }, 1500)
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [call])
  const action = async (method: 'restart' | 'stop' | 'test') => {
    const controller = lifetime.current
    if (!call || !controller) return
    setBusy(true); setError(''); setTesting(undefined)
    try {
      const next = await call(method, AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]))
      if (controller.signal.aborted) return
      if (typeof next === 'number') setTesting(next)
      else setStatus(next)
    } catch (e) { if (!controller.signal.aborted) setError(String(e)) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  const stage = Object.hasOwn(stages, status.message) ? t(stages[status.message as keyof typeof stages]) : status.message
  return <section aria-label={t('serviceTitle')} style={{ marginBottom: 16 }}>
    <p role="status"><strong>{t('serviceTitle')}: {t(labels[status.phase])}</strong>{stage ? ` · ${stage}` : ''}</p>
    {status.endpoint && <p>{t('activeEndpoint')}: {status.endpoint}</p>}
    <p>{t('serviceHint')}</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {status.phase !== 'external' && <>
        <Button variant="outline" size="sm" disabled={!call || busy || !writable} onClick={() => { void action('restart') }}>{t('serviceRestart')}</Button>
        <Button variant="outline" size="sm" disabled={!call || busy || !writable || status.phase === 'stopped'} onClick={() => { void action('stop') }}>{t('serviceStop')}</Button>
      </>}
      <Button variant="outline" size="sm" disabled={!call || busy || !status.endpoint} onClick={() => { void action('test') }}>{t('serviceTest')}</Button>
    </div>
    {testing !== undefined && <p role="status">{t('serviceTestResult')}: {testing}</p>}
    {(error || pollError) && <p role="alert">{error || pollError}</p>}
    {status.logs && <details><summary>{t('serviceLogs')}</summary><pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{status.logs}</pre></details>}
  </section>
}
