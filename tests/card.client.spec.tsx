// @vitest-environment jsdom
/** The SearXNG search page as the Plugins page renders it: its three fields and their resets. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from './helpers.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsFieldState, SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives'
import { SearxngSearchCard, type SearxngSearchCardProps } from '../src/client/SearxngSearchCard.tsx'
import type { SearxngSearchCardState } from '../src/client/searxng-search-card-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

const settled: SettingsFormShell = { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }

function field(text: string, rest: Partial<SettingsFieldState> = {}): SettingsFieldState {
  return { text, overridden: false, invalid: false, ...rest }
}

function cardActions() {
  return { edit: vi.fn(), resetField: vi.fn(), save: vi.fn(), discard: vi.fn() }
}

function cardStore(state: Partial<SearxngSearchCardState> = {}) {
  return createSnapshotStore<SearxngSearchCardState>({
    ...settled,
    baseURL: field(''),
    engines: field(''),
    language: field(''),
    ...state,
  })
}

describe('SearxngSearchCard', () => {
  function renderCard(state: Partial<SearxngSearchCardState> = {}) {
    const store = cardStore(state)
    const actions = cardActions()
    const props = { ...actions, view: 'page', t, useSearxngSearchCard: bindSnapshotSelector(store) } as SearxngSearchCardProps
    render(<SearxngSearchCard {...props} />)
    return actions
  }

  it('renders its one-liner alone in the summary view', () => {
    const props = { ...cardActions(), view: 'summary', t, useSearxngSearchCard: bindSnapshotSelector(cardStore()) } as SearxngSearchCardProps
    render(<SearxngSearchCard {...props} />)

    expect(document.body.textContent).toBe(en.description)
    expect(screen.queryByLabelText(en.baseUrl)).toBeNull()
  })

  it('disables every field while the settings document is read-only', () => {
    renderCard({ writable: false })

    expect(screen.getByLabelText(en.baseUrl)).toHaveProperty('disabled', true)
    expect(screen.getByLabelText(en.engines)).toHaveProperty('disabled', true)
    expect(screen.getByLabelText(en.language)).toHaveProperty('disabled', true)
  })

  it('stages the endpoint, engines, and language, and their resets', () => {
    const actions = renderCard({
      baseURL: field('http://localhost:8080', { overridden: true }),
      engines: field('bing', { overridden: true }),
      language: field('zh-CN', { overridden: true }),
    })

    fireEvent.change(screen.getByLabelText(en.baseUrl), { target: { value: 'http://other.test' } })
    fireEvent.change(screen.getByLabelText(en.engines), { target: { value: 'bing,duckduckgo' } })
    fireEvent.change(screen.getByLabelText(en.language), { target: { value: 'en' } })
    const resets = screen.getAllByRole('button', { name: en.reset })
    expect(resets).toHaveLength(3)
    for (const reset of resets) fireEvent.click(reset)

    expect(actions.edit.mock.calls).toEqual([
      ['baseURL', 'http://other.test'],
      ['engines', 'bing,duckduckgo'],
      ['language', 'en'],
    ])
    expect(actions.resetField.mock.calls).toEqual([['baseURL'], ['engines'], ['language']])
  })
})
