/**
 * Real HTTP coverage proves whether native `fetch` contacts a cross-origin `Location`; mocked
 * request-init assertions alone cannot observe that boundary. A SearXNG request carries the query
 * text in its URL, so following a redirect would forward the query to the redirect target.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { SearxngSearchProvider } from '../src/index.ts'

/** Construct the provider over a fixed options value; production passes a live thunk. */
import type { SearxngSearchProviderOptions } from '../src/index.ts'

const searchProvider = (options: SearxngSearchProviderOptions): SearxngSearchProvider =>
  new SearxngSearchProvider(() => options)

const TEST_QUERY = 'private redirect query'
const targetRequests: string[] = []

const targetServer = createServer((request, response) => {
  request.resume()
  targetRequests.push(request.url ?? '')
  response.writeHead(204).end()
})

const redirectServer = createServer((request, response) => {
  request.resume()
  // Echo the query into Location so a followed redirect demonstrably forwards it.
  const search = new URL(request.url ?? '/', 'http://fixture.test').search
  response.writeHead(302, { location: `${targetOrigin}/collect${search}` }).end()
})

let redirectOrigin: string
let targetOrigin: string

beforeAll(async () => {
  targetOrigin = await listen(targetServer)
  redirectOrigin = await listen(redirectServer)
})

afterAll(async () => {
  await Promise.all([close(redirectServer), close(targetServer)])
})

describe('SearxngSearchProvider redirect policy', () => {
  it('rejects a redirect before contacting Location', async () => {
    targetRequests.length = 0
    await expect(searchProvider({ baseURL: redirectOrigin }).search({ query: TEST_QUERY }))
      .rejects.toMatchObject({ code: 'WEB_PROVIDER_ERROR' })
    expect(targetRequests).toHaveLength(0)
  })

  it('shows default redirect following forwards the query text', async () => {
    targetRequests.length = 0
    const url = new URL('search', `${redirectOrigin}/`)
    url.searchParams.set('q', TEST_QUERY)
    await fetch(url)

    expect(targetRequests).toHaveLength(1)
    expect(targetRequests[0]).toContain(encodeURIComponent(TEST_QUERY).replace(/%20/g, '+'))
  })
})

/** Listen on an ephemeral loopback port and return the server origin. */
async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

/** Close a listening fixture server after every request has settled. */
async function close(server: Server): Promise<void> {
  if (!server.listening) return
  await new Promise<void>((resolve, reject) => server.close((error) => {
    if (error) reject(error)
    else resolve()
  }))
}
