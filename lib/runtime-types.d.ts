/** JSON values shared by the Host manager and browser card. */
export type ServiceMode = 'auto' | 'local' | 'external';
export type ServicePhase = 'idle' | 'preparing' | 'starting' | 'ready' | 'stopped' | 'failed' | 'external';
/** A bounded service snapshot; no model or API credentials are included. */
export interface ServiceStatus {
    phase: ServicePhase;
    endpoint: string;
    message: string;
    logs: string;
}
/** Validate a response received over the authenticated Connection carrier. */
export declare function parseServiceStatus(value: unknown): ServiceStatus;
//# sourceMappingURL=runtime-types.d.ts.map