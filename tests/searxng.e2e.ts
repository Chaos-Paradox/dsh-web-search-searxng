import { describe, expect, it } from 'vitest'
import { SearxngSearchProvider } from '../src/index.ts'

/**
 * Opt-in real-instance probe for the SearXNG search provider. A live
 * instance's engine mix and rate limits vary by deployment, so this is not a
 * reliable merge signal. Its body remains because mocks cannot confirm the
 * wire shape. Run it with `SEARXNG_BASE_URL` pointing at a JSON-enabled
 * instance.
 */
const baseURL = process.env.SEARXNG_BASE_URL
const maybe = baseURL !== undefined && baseURL.length > 0 ? describe : describe.skip

maybe('SearxngSearchProvider real instance', () => {
  it('returns citeable sources for a live query', async () => {
    const provider = new SearxngSearchProvider(() => ({ baseURL: baseURL! }))
    const result = await provider.search({ query: 'deepseek harness' })
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources[0]?.url).toMatch(/^https?:\/\//)
  })
})
