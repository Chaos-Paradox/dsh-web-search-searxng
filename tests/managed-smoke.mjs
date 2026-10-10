/** Opt-in real first-use setup and teardown using shipped JS and public DSH processes. */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocess from '@deepseek-ai/dsh-subprocess-local'
import { WebRuntime } from '@deepseek-ai/dsh-web'
import * as plugin from '../lib/index.js'

const dir = await mkdtemp(join(tmpdir(), 'searxng-clean-'))
const ctx = new Context()
let endpoint = ''
try {
  ctx.provide('profileContext', { dir })
  await ctx.plugin(LocalSubprocess)
  await ctx.plugin(WebRuntime, { searchProvider: 'searxng' })
  const fiber = await ctx.plugin(plugin, { mode: 'local', engines: 'bing,yahoo' })
  let previous = ''
  const deadline = Date.now() + 720000
  while (true) {
    const status = ctx.searxngRuntime.status()
    const progress = `${status.phase}: ${status.message}`
    if (progress !== previous) { console.log(progress); previous = progress }
    if (status.phase === 'failed') throw new Error(`${status.message}\n${status.logs}`)
    if (status.phase === 'ready') { endpoint = status.endpoint; break }
    if (Date.now() > deadline) throw new Error('Managed setup timed out')
    await delay(500)
  }
  assert.match(endpoint, /^http:\/\/127\.0\.0\.1:\d+$/)
  const config = await fetch(`${endpoint}/config`).then(r => r.json())
  assert.ok(Array.isArray(config.engines))
  if (process.env.SEARXNG_SMOKE_SEARCH !== '0') {
    const result = await ctx.web.search({ query: 'DeepSeek Harness GitHub', maxResults: 3 })
    assert.ok(result.sources.length > 0, 'A real managed search must return sources')
    assert.ok(result.sources.length <= 3)
    console.log(`real search: ${result.sources.length} sources`)
  }
  await ctx.searxngRuntime.stop()
  assert.equal(ctx.searxngRuntime.status().phase, 'stopped')
  await assert.rejects(fetch(`${endpoint}/config`, { signal: AbortSignal.timeout(2000) }))
  ctx.searxngRuntime.restart()
  while (ctx.searxngRuntime.status().phase !== 'ready') {
    const status = ctx.searxngRuntime.status()
    if (status.phase === 'failed') throw new Error(status.message)
    if (Date.now() > deadline) throw new Error('Cached restart timed out')
    await delay(500)
  }
  endpoint = ctx.searxngRuntime.status().endpoint
  await fiber.dispose()
  await assert.rejects(fetch(`${endpoint}/config`, { signal: AbortSignal.timeout(2000) }))
  console.log('PASS: clean automatic setup, HTTP readiness, cached restart, stop and plugin teardown')
} finally {
  await ctx.fiber.dispose()
  await rm(dir, { recursive: true, force: true })
}
