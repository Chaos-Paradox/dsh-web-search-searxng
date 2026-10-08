import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import { SearxngSearchProvider, SEARXNG_PROVIDER_ID } from '../src/index.ts'
import * as searxngPlugin from '../src/index.ts'
import { mapSearxngResponse, mapSearxngResult } from '../src/provider.ts'
import type { SearxngResult } from '../src/types.ts'

const options = { baseURL: 'http://searxng.test' }

function provider(overrides: Partial<typeof options & { engines: string; language: string }> = {}) {
  const resolved = { ...options, ...overrides }
  return new SearxngSearchProvider(() => resolved)
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>

function stubFetch(impl: () => Promise<Response>): FetchMock {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The URL a mock call received, as text. The provider always fetches a URL object. */
function calledUrl(fetchMock: FetchMock, index: number): string | undefined {
  const input = fetchMock.mock.calls.at(index)?.[0]
  if (input instanceof URL) return input.toString()
  return typeof input === 'string' ? input : undefined
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SearXNG result mapping', () => {
  it('maps a full result entry', () => {
    expect(mapSearxngResult({
      url: 'https://a.test',
      title: 'A',
      content: 'an excerpt',
      publishedDate: '2026-01-01',
    })).toEqual({ url: 'https://a.test', title: 'A', snippet: 'an excerpt', publishedAt: '2026-01-01' })
  })

  it('drops an entry with no usable URL', () => {
    expect(mapSearxngResult({ url: '' })).toBeUndefined()
    expect(mapSearxngResult({ url: '  ' })).toBeUndefined()
    // A wire entry may omit the field entirely; JSON.parse keeps the test at that boundary.
    expect(mapSearxngResult(JSON.parse('{"title": "x"}') as SearxngResult)).toBeUndefined()
  })

  it('keeps a URL-only entry and omits blank optional fields', () => {
    expect(mapSearxngResult({ url: 'https://a.test' })).toEqual({ url: 'https://a.test' })
    expect(mapSearxngResult({ url: 'https://a.test', title: '', content: '  ', publishedDate: '' }))
      .toEqual({ url: 'https://a.test' })
  })

  it('maps a response with URL-less entries filtered out', () => {
    const result = mapSearxngResponse({
      results: [
        { url: 'https://a.test', content: 'one' },
        { url: '' },
        { url: 'https://b.test', title: 'B' },
      ],
    })
    expect(result).toEqual({
      sources: [
        { url: 'https://a.test', snippet: 'one' },
        { url: 'https://b.test', title: 'B' },
      ],
      truncated: false,
    })
    expect(result.content).toBeUndefined()
  })

  it('tolerates a missing results array', () => {
    expect(mapSearxngResponse({}).sources).toEqual([])
  })

  it('rejects a results field that is not an array', () => {
    expect(() => mapSearxngResponse({ results: {} as never }))
      .toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR', message: 'SearXNG returned a malformed results field' }))
  })
})

describe('SearxngSearchProvider availability', () => {
  it('is unavailable without a base URL', () => {
    expect(provider({ baseURL: '' }).available()).toBe(false)
  })

  it('is misconfigured when the base URL is unparseable', () => {
    expect(provider({ baseURL: 'not a url' }).available()).toBe(false)
  })

  it('is available with a parseable base URL', () => {
    expect(provider().available()).toBe(true)
  })
})

describe('SearxngSearchProvider request mapping', () => {
  it('sends the query and json format as GET parameters', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ results: [] }))

    await provider().search({ query: 'hello world' })

    expect(fetchMock).toHaveBeenCalledOnce()
    const call = fetchMock.mock.calls.at(0)
    expect(calledUrl(fetchMock, 0)).toBe('http://searxng.test/search?q=hello+world&format=json')
    expect(call?.[1]).toMatchObject({ method: 'GET', redirect: 'error' })
    expect((call?.[1]?.headers as Record<string, string> | undefined)?.['accept']).toBe('application/json')
  })

  it('appends engines and language only when configured non-blank', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ results: [] }))

    await provider({ engines: 'bing,duckduckgo', language: 'zh-CN' }).search({ query: 'q' })
    expect(calledUrl(fetchMock, 0))
      .toBe('http://searxng.test/search?q=q&format=json&engines=bing%2Cduckduckgo&language=zh-CN')

    await provider({ engines: '  ', language: '' }).search({ query: 'q' })
    expect(calledUrl(fetchMock, 1)).toBe('http://searxng.test/search?q=q&format=json')
  })

  it('preserves a subpath mount when appending /search', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ results: [] }))

    await provider({ baseURL: 'http://searxng.test/searxng' }).search({ query: 'q' })
    expect(calledUrl(fetchMock, 0)).toBe('http://searxng.test/searxng/search?q=q&format=json')

    await provider({ baseURL: 'http://searxng.test/' }).search({ query: 'q' })
    expect(calledUrl(fetchMock, 1)).toBe('http://searxng.test/search?q=q&format=json')
  })

  it('forwards the abort signal', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ results: [] }))
    const controller = new AbortController()
    await provider().search({ query: 'q' }, controller.signal)
    expect(fetchMock.mock.calls.at(0)?.[1]?.signal).toBe(controller.signal)
  })
})

describe('SearxngSearchProvider error handling', () => {
  it('maps an HTTP error to WEB_PROVIDER_ERROR with the status', async () => {
    stubFetch(async () => new Response('oops', { status: 500 }))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR', message: 'SearXNG error (HTTP 500)' }))
  })

  it('adds the JSON-format hint to a 403', async () => {
    stubFetch(async () => new Response('forbidden', { status: 403 }))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({
        code: 'WEB_PROVIDER_ERROR',
        message: 'SearXNG error (HTTP 403); the instance may refuse JSON output — enable the "json" format in its search.formats setting',
      }))
  })

  it('maps a network failure to WEB_PROVIDER_ERROR', async () => {
    stubFetch(() => Promise.reject(new TypeError('connection refused')))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })

  it('maps an abort to WEB_ABORTED', async () => {
    stubFetch(() => Promise.reject(new DOMException('aborted', 'AbortError')))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })

  it('maps a failure under an already-aborted signal to WEB_ABORTED', async () => {
    stubFetch(() => Promise.reject(new TypeError('socket closed')))
    const controller = new AbortController()
    controller.abort()
    await expect(provider().search({ query: 'q' }, controller.signal))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })

  it('maps an unparseable success body to WEB_PROVIDER_ERROR', async () => {
    stubFetch(async () => new Response('not json', { status: 200 }))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })

  it('maps a well-formed body of the wrong shape to WEB_PROVIDER_ERROR', async () => {
    stubFetch(async () => jsonResponse({ results: {} }))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({
        code: 'WEB_PROVIDER_ERROR',
        message: 'SearXNG returned a malformed results field',
      }))
  })

  it('surfaces an abort during success-body parse as WEB_ABORTED, not provider error', async () => {
    const body = { json: (): Promise<unknown> => Promise.reject(new DOMException('aborted', 'AbortError')), ok: true, status: 200 } as const
    stubFetch(async () => body as Response)
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })

  it('surfaces a parse failure under an already-aborted signal as WEB_ABORTED', async () => {
    const body = { json: (): Promise<unknown> => Promise.reject(new SyntaxError('bad json')), ok: true, status: 200 } as const
    stubFetch(async () => body as Response)
    const controller = new AbortController()
    controller.abort()
    await expect(provider().search({ query: 'q' }, controller.signal))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })
})

describe('web-search-searxng plugin registration', () => {
  it('refuses activation on an unmodified host', async () => {
    const ctx = new Context()
    await ctx.plugin(WebRuntime)
    await expect(ctx.plugin(searxngPlugin, { baseURL: 'http://searxng.test' }).await()).rejects.toThrow('bundle config-effects integration')
  })

  it('refuses an overridden route instead of claiming the plugin is active', async () => {
    const ctx = new Context()
    ctx.provide('configEditor', { supportsBundleConfigEffects: true, configuration: () => [{ entry: { options: { id: 'web', config: { searchProvider: 'other' } } } }] })
    await ctx.plugin(WebRuntime, { searchProvider: 'other' })
    await expect(ctx.plugin(searxngPlugin, { baseURL: 'http://searxng.test' }).await()).rejects.toThrow('remove conflicting home/CLI overrides')
  })

  it('registers the provider into ctx.web (HMR-safe)', async () => {
    stubFetch(async () => jsonResponse({ results: [] }))
    const ctx = new Context()
    ctx.provide('configEditor', { supportsBundleConfigEffects: true, configuration: () => [{ entry: { options: { id: 'web', config: { searchProvider: 'searxng' } } } }] })
    await ctx.plugin(WebRuntime, { searchProvider: SEARXNG_PROVIDER_ID })
    const fiber = await ctx.plugin(searxngPlugin, { baseURL: 'http://searxng.test' })
    await expect(ctx.web.search({ query: 'q' })).resolves.toMatchObject({ sources: [], truncated: false })
    await fiber.dispose()
    await expect(ctx.web.search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' }))
  })

  it('has no default export (namespace plugin export shape)', () => {
    expect('default' in searxngPlugin).toBe(false)
  })

  it('threads engines and language config into the request', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ results: [] }))
    const ctx = new Context()
    ctx.provide('configEditor', { supportsBundleConfigEffects: true, configuration: () => [{ entry: { options: { id: 'web', config: { searchProvider: 'searxng' } } } }] })
    await ctx.plugin(WebRuntime, { searchProvider: SEARXNG_PROVIDER_ID })
    const fiber = await ctx.plugin(searxngPlugin, { baseURL: 'http://searxng.test', engines: 'bing', language: 'en' })
    await ctx.web.search({ query: 'q' })
    expect(calledUrl(fetchMock, 0))
      .toBe('http://searxng.test/search?q=q&format=json&engines=bing&language=en')
    await fiber.dispose()
  })

  it('falls back to $SEARXNG_BASE_URL when config omits the endpoint', async () => {
    const prev = process.env.SEARXNG_BASE_URL
    process.env.SEARXNG_BASE_URL = 'http://env-searxng.test'
    try {
      const fetchMock = stubFetch(async () => jsonResponse({ results: [] }))
      const ctx = new Context()
    ctx.provide('configEditor', { supportsBundleConfigEffects: true, configuration: () => [{ entry: { options: { id: 'web', config: { searchProvider: 'searxng' } } } }] })
      await ctx.plugin(WebRuntime, { searchProvider: SEARXNG_PROVIDER_ID })
      const fiber = await ctx.plugin(searxngPlugin, {})
      await ctx.web.search({ query: 'q' })
      expect(calledUrl(fetchMock, 0)).toBe('http://env-searxng.test/search?q=q&format=json')
      await fiber.dispose()
    } finally {
      if (prev === undefined) delete process.env.SEARXNG_BASE_URL
      else process.env.SEARXNG_BASE_URL = prev
    }
  })

  it('is unavailable when neither config nor env supplies an endpoint', async () => {
    const prev = process.env.SEARXNG_BASE_URL
    delete process.env.SEARXNG_BASE_URL
    try {
      const ctx = new Context()
    ctx.provide('configEditor', { supportsBundleConfigEffects: true, configuration: () => [{ entry: { options: { id: 'web', config: { searchProvider: 'searxng' } } } }] })
      await ctx.plugin(WebRuntime, { searchProvider: SEARXNG_PROVIDER_ID })
      await ctx.plugin(searxngPlugin, {})
      await expect(ctx.web.search({ query: 'q' }))
        .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE' }))
    } finally {
      if (prev !== undefined) process.env.SEARXNG_BASE_URL = prev
    }
  })
})
