/** JSON values shared by the Host manager and browser card. */
export type ServiceMode = 'auto' | 'local' | 'external'
export type ServicePhase = 'idle' | 'preparing' | 'starting' | 'ready' | 'stopped' | 'failed' | 'external'

/** A bounded service snapshot; no model or API credentials are included. */
export interface ServiceStatus {
  phase: ServicePhase
  endpoint: string
  message: string
  logs: string
}

/** Validate a response received over the authenticated Connection carrier. */
export function parseServiceStatus(value: unknown): ServiceStatus {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid service response')
  const phase = Reflect.get(value, 'phase')
  if (!['idle', 'preparing', 'starting', 'ready', 'stopped', 'failed', 'external'].includes(phase)) throw new Error('Invalid service phase')
  for (const key of ['endpoint', 'message', 'logs']) if (typeof Reflect.get(value, key) !== 'string') throw new Error(`Invalid service ${key}`)
  return value as ServiceStatus
}
