// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ServicePanel } from '../src/client/ServicePanel.tsx'
import { en } from '../src/client/locales.ts'
import type { ServiceStatus } from '../src/runtime-types.ts'
afterEach(cleanup)
const t = (key: keyof typeof en) => en[key]
const ready: ServiceStatus = { phase: 'ready', endpoint: 'http://127.0.0.1:43210', message: '', logs: 'local log' }

it('shows live readiness and sends restart, test and stop through operator actions', async () => {
  const call = vi.fn(async (method: string): Promise<ServiceStatus | number> => method === 'test' ? 3 : method === 'stop' ? { ...ready, phase: 'stopped', endpoint: '' } : ready)
  render(<ServicePanel call={call} t={t} writable />)
  await screen.findByText(`${en.activeEndpoint}: ${ready.endpoint}`)
  fireEvent.click(screen.getByRole('button', { name: en.serviceTest }))
  await screen.findByText(`${en.serviceTestResult}: 3`)
  fireEvent.click(screen.getByRole('button', { name: en.serviceRestart }))
  await waitFor(() => expect(call.mock.calls.some(c => c[0] === 'restart')).toBe(true))
  await waitFor(() => expect(screen.getByRole('button', { name: en.serviceStop })).toHaveProperty('disabled', false))
  fireEvent.click(screen.getByRole('button', { name: en.serviceStop }))
  await screen.findByText(`${en.serviceTitle}: ${en.serviceStopped}`)
  expect(screen.getByText('local log')).toBeTruthy()
})

it('does not expose start or stop actions for an external instance', async () => {
  render(<ServicePanel call={async () => ({ ...ready, phase: 'external' })} t={t} writable />)
  await screen.findByText(`${en.serviceTitle}: ${en.serviceExternal}`)
  expect(screen.queryByRole('button', { name: en.serviceRestart })).toBeNull()
  expect(screen.queryByRole('button', { name: en.serviceStop })).toBeNull()
})

it('cancels pending polling on unmount and renders RPC errors', async () => {
  const signals: AbortSignal[] = []
  const { unmount } = render(<ServicePanel call={async (_method, signal) => { signals.push(signal); throw new Error('connection failed') }} t={t} writable />)
  await screen.findByRole('alert')
  unmount()
  expect(signals[0]!.aborted).toBe(true)
})
