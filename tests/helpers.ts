/**
 * Local stand-ins for the two `@deepseek-ai/dsh-client-test-runtime` helpers
 * these specs use. The published test-runtime currently imports source paths
 * that the npm package does not ship, so these copies keep the standalone
 * suite runnable. Keep them behavior-identical to the upstream helpers.
 */
import { vi } from 'vitest'
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector'
import type { HostObservable, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsFormScope, SettingsFormScopeSnapshot } from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * Bind a bare observable source to a typed uSES selector hook.
 * @param w - snapshot source (a store instance).
 * @returns the selector hook.
 */
export function bindSnapshotSelector<T>(w: HostObservable<T>): SnapshotSelectorHook<T> {
  const subscribe = (fn: () => void) => w.subscribe(fn)
  const getSnapshot = () => w.getSnapshot()
  return function useSelector<S>(sel: (s: T) => S, eq?: (a: S, b: S) => boolean): S {
    return useSyncExternalStoreWithSelector(subscribe, getSnapshot, undefined, sel, eq)
  }
}

/** A scriptable settings scope: publish drives subscribers, set/mutate/unset are spies. */
export interface StubConfigForm<T> {
  readonly scope: SettingsFormScope<T>
  readonly set: ReturnType<typeof vi.fn>
  readonly mutate: ReturnType<typeof vi.fn>
  readonly unset: ReturnType<typeof vi.fn>
  readonly listenerCount: () => number
  readonly publish: (next: Partial<SettingsFormScopeSnapshot<T>>) => void
}

/**
 * Build a stub settings scope.
 * @returns the scope plus its spies and the publish driver.
 */
export function stubConfigForm<T>(): StubConfigForm<T> {
  let snapshot = {
    status: 'loading', value: undefined, base: undefined, user: undefined,
    writable: false,
  } as unknown as SettingsFormScopeSnapshot<T>
  const listeners = new Set<() => void>()
  const set = vi.fn(() => Promise.resolve(true))
  const mutate = vi.fn(() => Promise.resolve(true))
  const unset = vi.fn(() => Promise.resolve(true))
  const scope = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    mutate,
    set,
    unset,
  } as unknown as SettingsFormScope<T>
  return {
    scope,
    set,
    mutate,
    unset,
    listenerCount: () => listeners.size,
    publish: (next) => {
      snapshot = { ...snapshot, ...next }
      for (const listener of [...listeners]) listener()
    },
  }
}
