/**
 * Official-fallback unit tests. The acceptance invariant lives here: with the
 * fallback at its default (off), a failed SearXNG search makes ZERO official
 * requests; with it explicitly on, exactly the failed request degrades, the
 * result carries the bilingual cost notice, and the host log records the
 * actual provider and reason.
 */

import { describe, expect, it, vi } from 'vitest'
import { WebError } from '@deepseek-ai/dsh-web'
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'
import {
  createOfficialFallbackResolver,
  fallbackNotice,
  SearxngFallbackProvider,
  type FallbackRecord,
} from '../src/fallback.ts'
import { SEARXNG_PROVIDER_ID } from '../src/provider.ts'

const REQUEST: WebSearchRequest = { query: 'q' }
const OFFICIAL_RESULT: WebSearchResult = {
  sources: [{ url: 'https://official.test/a', title: 'A' }],
  truncated: false,
}

function failingPrimary(error: Error): WebSearchProvider & { search: ReturnType<typeof vi.fn> } {
  return {
    id: SEARXNG_PROVIDER_ID,
    available: () => true,
    search: vi.fn(() => Promise.reject(error)),
  }
}

function stubOfficial(result: WebSearchResult = OFFICIAL_RESULT) {
  const search = vi.fn(() => Promise.resolve(result))
  return { provider: { id: 'deepseek-official', available: () => true, search } as WebSearchProvider, search }
}

function harness(overrides: {
  enabled?: boolean
  official?: WebSearchProvider | undefined
  primary?: WebSearchProvider
} = {}) {
  const primary = overrides.primary ?? failingPrimary(new WebError('SearXNG search request failed: fetch failed', 'WEB_PROVIDER_ERROR'))
  const onDegraded = vi.fn<(record: FallbackRecord) => void>()
  const officialResolver = vi.fn(() => Promise.resolve(overrides.official))
  const provider = new SearxngFallbackProvider(primary, {
    enabled: () => overrides.enabled ?? false,
    official: officialResolver,
    onAttempt: vi.fn(),
    onDegraded,
  })
  return { provider, primary, onDegraded, officialResolver }
}

describe('SearxngFallbackProvider strict default', () => {
  it('makes zero official requests when the fallback is off', async () => {
    const { provider, officialResolver, onDegraded } = harness({ enabled: false })
    await expect(provider.search(REQUEST)).rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
    expect(officialResolver).not.toHaveBeenCalled()
    expect(onDegraded).not.toHaveBeenCalled()
  })

  it('exposes the primary id and availability, never the fallback\'s', () => {
    const { provider } = harness()
    expect(provider.id).toBe(SEARXNG_PROVIDER_ID)
    expect(provider.available()).toBe(true)
    const down = harness({ primary: { id: SEARXNG_PROVIDER_ID, available: () => false, search: vi.fn() } })
    expect(down.provider.available()).toBe(false)
  })

  it('never degrades a cancelled request, even when enabled', async () => {
    const aborted = harness({
      enabled: true,
      official: stubOfficial().provider,
      primary: failingPrimary(new WebError('SearXNG search aborted', 'WEB_ABORTED')),
    })
    await expect(aborted.provider.search(REQUEST)).rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
    expect(aborted.officialResolver).not.toHaveBeenCalled()
  })

  it('never degrades when the signal already aborted', async () => {
    const { provider, officialResolver } = harness({ enabled: true, official: stubOfficial().provider })
    const controller = new AbortController()
    controller.abort()
    await expect(provider.search(REQUEST, controller.signal)).rejects.toThrow()
    expect(officialResolver).not.toHaveBeenCalled()
  })
})

describe('SearxngFallbackProvider opt-in degradation', () => {
  it('serves the failed request through the official route with a notice', async () => {
    const official = stubOfficial()
    const { provider, onDegraded } = harness({ enabled: true, official: official.provider })
    const result = await provider.search(REQUEST)
    expect(official.search).toHaveBeenCalledTimes(1)
    expect(result).toMatchInlineSnapshot(`
      {
        "content": "⚠️ SearXNG search failed (SearXNG search request failed: fetch failed); this request fell back to the official DeepSeek search — extra cost may apply, and the route itself was NOT changed.
      ⚠️ SearXNG 搜索失败（SearXNG search request failed: fetch failed），本次请求已降级到 DeepSeek 官方搜索——可能产生额外费用；路由本身未被更改。",
        "sources": [
          {
            "title": "A",
            "url": "https://official.test/a",
          },
        ],
        "truncated": false,
      }
    `)
    expect(result.content).toContain('fell back to the official DeepSeek search')
    expect(result.content).toContain('已降级到 DeepSeek 官方搜索')
    expect(result.content).toContain('SearXNG search request failed')
    expect(onDegraded).toHaveBeenCalledTimes(1)
    expect(onDegraded.mock.calls[0]![0]).toMatchObject({ sources: 1 })
    expect(onDegraded.mock.calls[0]![0].reason).toContain('fetch failed')
  })

  it('degrades only the failed request: the next success stays on SearXNG', async () => {
    let calls = 0
    const flaky: WebSearchProvider = {
      id: SEARXNG_PROVIDER_ID,
      available: () => true,
      search: vi.fn(() => {
        calls += 1
        return calls === 1
          ? Promise.reject(new WebError('boom', 'WEB_PROVIDER_ERROR'))
          : Promise.resolve({ sources: [{ url: 'https://searxng.test/x' }], truncated: false })
      }),
    }
    const official = stubOfficial()
    const { provider } = harness({ enabled: true, official: official.provider, primary: flaky })
    await provider.search(REQUEST)
    const second = await provider.search(REQUEST)
    expect(official.search).toHaveBeenCalledTimes(1)
    expect(second.content).toBeUndefined()
  })

  it('rethrows the primary error when no official provider exists here', async () => {
    const { provider, onDegraded } = harness({ enabled: true, official: undefined })
    await expect(provider.search(REQUEST)).rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
    expect(onDegraded).not.toHaveBeenCalled()
  })

  it('rethrows the primary error when the official provider is unusable', async () => {
    const official = stubOfficial()
    official.provider = { ...official.provider, available: () => false }
    const { provider } = harness({ enabled: true, official: official.provider })
    await expect(provider.search(REQUEST)).rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
    expect(official.search).not.toHaveBeenCalled()
  })

  it.each(['cancel', 'disable'])('starts no paid request when %s happens during provider resolution', async action => {
    const resolving = Promise.withResolvers<WebSearchProvider>()
    const started = Promise.withResolvers<void>()
    const official = stubOfficial()
    let enabled = true
    const controller = new AbortController()
    const onAttempt = vi.fn()
    const provider = new SearxngFallbackProvider(failingPrimary(new WebError('primary failed', 'WEB_PROVIDER_ERROR')), {
      enabled: () => enabled,
      official: () => { started.resolve(); return resolving.promise },
      onAttempt,
      onDegraded: vi.fn(),
    })
    const request = provider.search(REQUEST, controller.signal)
    await started.promise
    if (action === 'cancel') controller.abort()
    else enabled = false
    resolving.resolve(official.provider)
    await expect(request).rejects.toThrow('primary failed')
    expect(official.search).not.toHaveBeenCalled()
    expect(onAttempt).not.toHaveBeenCalled()
  })

  it('propagates an official-route failure as its own error', async () => {
    const official = {
      id: 'deepseek-official',
      available: () => true,
      search: vi.fn(() => Promise.reject(new WebError('DeepSeek search failed', 'WEB_PROVIDER_ERROR'))),
    } satisfies WebSearchProvider
    const { provider } = harness({ enabled: true, official })
    await expect(provider.search(REQUEST)).rejects.toThrow('official fallback also failed (DeepSeek search failed)')
  })
})

describe('fallbackNotice', () => {
  it('truncates an over-long reason', () => {
    const notice = fallbackNotice('x'.repeat(500))
    expect(notice.length).toBeLessThan(700)
    expect(notice).toContain('…')
  })
})

describe('createOfficialFallbackResolver', () => {
  it('uses the registered host route with its existing options and cancellation', async () => {
    const searchWithProvider = vi.fn(() => Promise.resolve(OFFICIAL_RESULT))
    const resolve = createOfficialFallbackResolver({ web: { searchWithProvider } } as never)
    const provider = await resolve()
    const signal = new AbortController().signal
    await expect(provider?.search(REQUEST, signal)).resolves.toEqual(OFFICIAL_RESULT)
    expect(searchWithProvider).toHaveBeenCalledWith('deepseek-official', REQUEST, signal)
  })

  it('reports missing host support without constructing a credentialed provider', async () => {
    const resolve = createOfficialFallbackResolver({ web: {} } as never)
    await expect(resolve()).rejects.toThrow('host integration')
  })

  it('honors a disabled or absent registered official provider', async () => {
    const resolve = createOfficialFallbackResolver({ web: {
      searchWithProvider: () => Promise.reject(new WebError('configured provider missing', 'WEB_PROVIDER_CONFIGURED_MISSING')),
    } } as never)
    const provider = await resolve()
    await expect(provider?.search(REQUEST)).rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' })
  })
})
