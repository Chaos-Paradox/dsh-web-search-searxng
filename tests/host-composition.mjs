/** Built-artifact regression against an unpatched, built DSH checkout.
 * Run after build: DSH_SOURCE_ROOT=/path/to/deepseek-harness pnpm run test:host.
 * Uses real profile layers, Include, Loader, settings and bundle management;
 * only the official provider and SearXNG HTTP endpoint are deterministic probes.
 */
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const host = process.env.DSH_SOURCE_ROOT ?? resolve(root, '../deepseek-harness')
const anchor = join(host, 'apps/cli/package.json')
const requireHost = createRequire(join(host, 'packages/boot/app-boot/package.json'))
const hostModule = name => import(pathToFileURL(requireHost.resolve(name)).href)
const app = await hostModule('@deepseek-ai/dsh-app-boot')
const { default: Hmr } = await import(pathToFileURL(join(host, 'packages/boot/hmr/lib/index.js')).href)
const { default: Timer } = await hostModule('@deepseek-ai/cordis-plugin-timer')
const { parse } = await import('yaml')
assert.equal(app.getDshRuntimeVersion(), '0.2.1-alpha.2', 'Run against the currently supported unpatched DSH version')
assert.equal(app.evaluatePluginCompatibility(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))), undefined)

async function fixture(t, { user = [], home = [], overlays = [], selected = true } = {}) {
  const temporary = mkdtempSync(join(tmpdir(), 'searxng-host-'))
  let ctx
  const seen = []
  let status = 200
  const server = createServer((req, res) => {
    seen.push(req.url)
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ results: [
      { url: 'https://source.test/one', title: 'One', content: 'SearXNG excerpt', publishedDate: '2026-10-10' },
      { url: 'https://source.test/two', title: 'Two' },
    ] }))
  })
  t.after(async () => {
    await ctx?.fiber.dispose()
    server.closeAllConnections()
    await new Promise((done, reject) => server.close(error => error ? reject(error) : done()))
    rmSync(temporary, { recursive: true, force: true })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const endpoint = `http://127.0.0.1:${server.address().port}`
  const dir = join(temporary, 'profiles/test')
  const core = join(temporary, 'test-core')
  mkdirSync(core, { recursive: true })
  mkdirSync(join(dir, 'node_modules'), { recursive: true })
  symlinkSync(core, join(dir, 'node_modules/test-core'), 'dir')
  writeFileSync(join(core, 'package.json'), JSON.stringify({ name: 'test-core', dsh: { bundle: { patch: './cordis.patch.yml' } } }))
  const officialCalls = []
  const officialProbe = {
    inject: ['web'],
    apply(ctx) {
      for (const id of ['deepseek-official', 'previous-search']) ctx.web.registerSearchProvider({
        id, available: () => true,
        async search(request) { officialCalls.push({ id, request }); return { sources: [{ url: `https://${id}.test/` }], truncated: false } },
      })
      for (const id of ['http', 'previous-fetch']) ctx.web.registerFetchProvider({
        id, available: () => true, async fetch() { return { status: 200, content: id } },
      })
    },
  }
  writeFileSync(join(core, 'cordis.patch.yml'), JSON.stringify([{ insert: [
    { id: 'web', name: '@deepseek-ai/dsh-web', config: { searchProvider: 'previous-search', fetchProvider: 'previous-fetch' } },
    { id: 'official-probe', name: 'cordis:official-probe' },
    { id: 'config-editor', name: '@deepseek-ai/dsh-config-editor' },
    { id: 'settings', name: '@deepseek-ai/dsh-settings' },
    { id: 'plugin-manager', name: '@deepseek-ai/dsh-plugin-manager' },
  ] }]))
  symlinkSync(root, join(dir, 'node_modules/dsh-web-search-searxng'), 'dir')
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test-profile', private: true,
    dsh: { profile: { bundles: ['test-core', ...selected ? ['dsh-web-search-searxng'] : []] } },
    dependencies: { 'test-core': `link:${core}`, 'dsh-web-search-searxng': `link:${root}` },
  }))
  writeFileSync(join(dir, 'cordis.yml'), '[]\n')
  const initialUser = JSON.stringify([{ id: 'web-search-searxng', config: { baseURL: endpoint } }, ...user]) + '\n'
  writeFileSync(join(dir, 'cordis.patch.yml'), initialUser)
  writeFileSync(join(temporary, 'cordis.patch.yml'), JSON.stringify(home))
  const loaded = app.loadProfileDirectory('test', dir, anchor)
  assert.deepEqual(loaded.skippedBundles, [])
  const profile = { name: 'test', dir, patchPath: join(dir, 'cordis.patch.yml'), installAnchor: anchor,
    cwd: temporary, home: temporary, overlays, startedBundles: loaded.layers.map(layer => layer.packageName), telemetryDisabledEnv: undefined }
  const resolution = await app.createRuntimeResolution({ profile: loaded, home: temporary, installAnchor: anchor })
  ctx = await app.boot('test', join(dir, 'cordis.yml'), app.readProfilePatches('test', profile), async ctx => {
    ctx.provide('profileContext', profile)
    ctx.provide('appReady', { onReady(listener) { listener(); return () => {} } })
    ctx.loader.builtins['official-probe'] = officialProbe
    await ctx.plugin(app.PluginPackages, { resolution })
  })
  await ctx.plugin(Timer)
  await ctx.plugin(Hmr, { root: [], ignored: [], debounce: 0 })
  await ctx.hmr.runExclusive(async () => {})
  assert.equal('searchWithProvider' in ctx.web, false, 'The test must exercise an unpatched runtime')
  const reload = () => ctx.hmr.runExclusive(() => app.reconcileProfilePatches(ctx, app.readProfilePatches('test', profile), 'test'))
  return { ctx, dir, profile, endpoint, seen, officialCalls, initialUser, reload,
    fail: () => { status = 503 },
    row: id => [...ctx.loader.entries()].find(entry => entry.options.id === id),
  }
}

test('bundle activation dispatches HTTP search and maps sources; settings save applies without remount', async t => {
  const f = await fixture(t)
  const fiber = f.row('web-search-searxng').fiber
  const result = await f.ctx.web.search({ query: 'test query', maxResults: 1 })
  assert.deepEqual(result, { sources: [{ url: 'https://source.test/one', title: 'One', snippet: 'SearXNG excerpt', publishedAt: '2026-10-10' }], truncated: true })
  assert.deepEqual(f.officialCalls, [])
  assert.equal(readFileSync(f.profile.patchPath, 'utf8'), f.initialUser)
  await f.ctx.settings.update('web-search-searxng', { engines: 'bing', language: 'zh-CN', allowOfficialFallback: false })
  assert.equal(f.row('web-search-searxng').fiber, fiber)
  await f.ctx.web.search({ query: 'saved' })
  assert.match(f.seen.at(-1), /engines=bing&language=zh-CN/)
  assert.equal(parse(readFileSync(f.profile.patchPath, 'utf8')).some(row => row.id === 'web'), false)
  assert.equal(await f.ctx.web.fetch({ url: 'https://fetch.test' }).then(result => result.content), 'http')
})

test('default failures and opt-in on an unsupported host make no paid request; cancellation never degrades', async t => {
  const f = await fixture(t)
  f.fail()
  await assert.rejects(f.ctx.web.search({ query: 'fails' }), /SearXNG.*503/)
  await f.ctx.settings.update('web-search-searxng', { allowOfficialFallback: true })
  await assert.rejects(f.ctx.web.search({ query: 'unsupported' }), /SearXNG.*503.*fallback unavailable.*searchWithProvider.*no official request/s)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(f.ctx.web.search({ query: 'cancelled' }, controller.signal), { code: 'WEB_ABORTED' })
  assert.deepEqual(f.officialCalls, [])
})

test('bundle enable/disable restores arbitrary earlier routes, retains settings, and removal exposes the baseline', async t => {
  const f = await fixture(t, { selected: false })
  assert.match((await f.ctx.web.search({ query: 'before' })).sources[0].url, /previous-search/)
  assert.equal((await f.ctx.pluginManager.setBundleEnabled('dsh-web-search-searxng', true)).application, 'applied')
  assert.match((await f.ctx.web.search({ query: 'enabled' })).sources[0].url, /source.test/)
  await f.ctx.settings.update('web-search-searxng', { language: 'en' })
  const saved = readFileSync(f.profile.patchPath, 'utf8')
  assert.equal((await f.ctx.pluginManager.setBundleEnabled('dsh-web-search-searxng', false)).application, 'applied')
  assert.match((await f.ctx.web.search({ query: 'disabled' })).sources[0].url, /previous-search/)
  assert.equal((await f.ctx.web.fetch({ url: 'https://fetch.test' })).content, 'previous-fetch')
  assert.equal(readFileSync(f.profile.patchPath, 'utf8'), saved)
  assert.equal((await f.ctx.pluginManager.setBundleEnabled('dsh-web-search-searxng', true)).application, 'applied')
  await f.ctx.web.search({ query: 're-enabled' })
  assert.match(f.seen.at(-1), /language=en/)
  const removed = await f.ctx.pluginManager.removeBundle('dsh-web-search-searxng')
  assert.equal(removed.application, 'applied', JSON.stringify(removed))
  assert.equal(removed.packageResult.exitCode, 0)
  assert.equal(JSON.parse(readFileSync(join(f.dir, 'package.json'), 'utf8')).dependencies['dsh-web-search-searxng'], undefined)
  assert.match((await f.ctx.web.search({ query: 'removed' })).sources[0].url, /previous-search/)
  assert.equal(readFileSync(f.profile.patchPath, 'utf8'), saved)
})

for (const layer of ['user', 'home', 'overlays']) test(`${layer} route override wins and the provider still activates`, async t => {
  const f = await fixture(t, { [layer]: [{ id: 'web', config: { searchProvider: 'previous-search', fetchProvider: 'previous-fetch' } }] })
  assert.ok(f.row('web-search-searxng').fiber)
  assert.match((await f.ctx.web.search({ query: 'override' })).sources[0].url, /previous-search/)
  assert.deepEqual(f.seen, [])
})

test('disabling only the provider row fails visibly and never auto-selects official search', async t => {
  const f = await fixture(t)
  const plugin = (await f.ctx.pluginManager.listPlugins()).find(row => row.patchId === 'web-search-searxng')
  assert.equal((await f.ctx.pluginManager.setPluginEnabled(plugin.entryId, false)).application, 'applied')
  await assert.rejects(f.ctx.web.search({ query: 'row disabled' }), { code: 'WEB_PROVIDER_CONFIGURED_MISSING' })
  assert.deepEqual(f.officialCalls, [])
})

for (const layer of ['home', 'overlays']) test(`${layer} settings override rejects a card write without altering the profile`, async t => {
  const f = await fixture(t, { [layer]: [{ id: 'web-search-searxng', config: { language: 'ja', allowOfficialFallback: false } }] })
  await assert.rejects(f.ctx.settings.update('web-search-searxng', { language: 'en' }), /overridden by a home patch or command-line overlay/)
  assert.equal(readFileSync(f.profile.patchPath, 'utf8'), f.initialUser)
})
