/** Version comparison and the latest-release lookup behind the card's update button. */

import { describe, expect, it } from 'vitest'
import { checkLatestRelease, compareVersions, CURRENT_VERSION } from '../src/client/update-check.ts'

describe('compareVersions', () => {
  it('orders dotted versions and ignores a leading v', () => {
    expect(compareVersions('v0.2.0', '0.1.0')).toBeGreaterThan(0)
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0)
    expect(compareVersions('0.1.0', 'v0.1.0')).toBe(0)
    expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0)
  })

  it('treats missing segments as zero', () => {
    expect(compareVersions('0.1', '0.1.0')).toBe(0)
    expect(compareVersions('0.1.1', '0.1')).toBeGreaterThan(0)
  })
})

/** A fetch stub answering with one status and an optional JSON body. */
function fetchOf(status: number, body?: unknown): typeof fetch {
  return (() => Promise.resolve({
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  })) as unknown as typeof fetch
}

describe('checkLatestRelease', () => {
  it('reports a newer release without the leading v', async () => {
    expect(await checkLatestRelease(fetchOf(200, { tag_name: 'v99.0.0' })))
      .toEqual({ kind: 'newer', latest: '99.0.0' })
  })

  it('reports the installed version as current', async () => {
    expect(await checkLatestRelease(fetchOf(200, { tag_name: `v${CURRENT_VERSION}` })))
      .toEqual({ kind: 'latest' })
    expect(await checkLatestRelease(fetchOf(200, { tag_name: '0.0.1' })))
      .toEqual({ kind: 'latest' })
  })

  it('folds every failure into unknown', async () => {
    expect(await checkLatestRelease(fetchOf(404))).toEqual({ kind: 'unknown' })
    expect(await checkLatestRelease(fetchOf(200, {}))).toEqual({ kind: 'unknown' })
    const offline = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch
    expect(await checkLatestRelease(offline)).toEqual({ kind: 'unknown' })
  })
})
