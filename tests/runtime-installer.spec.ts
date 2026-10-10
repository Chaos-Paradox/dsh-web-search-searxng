import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import { applyWindowsCompatibility, extractRuntimeArchive, uvAsset, verifiedDownload } from '../src/runtime-installer.ts'
import { parseServiceStatus } from '../src/runtime-types.ts'

const dirs: string[] = []
afterEach(async () => { vi.unstubAllGlobals(); for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true }) })
async function directory() { const d = await mkdtemp(join(tmpdir(), 'searxng-installer-')); dirs.push(d); return d }

describe('verified runtime installation', () => {
  it.each(['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-arm64', 'win32-x64'])('selects an official pinned binary for %s', key => {
    const [platform, arch] = key.split('-')
    expect(uvAsset(platform!, arch!).hash).toMatch(/^[a-f0-9]{64}$/)
  })
  it('rejects unsupported systems before downloading anything', () => { expect(() => uvAsset('freebsd', 'x64')).toThrow(/external instance/) })
  it('writes only downloads matching the pinned hash', async () => {
    const dir = await directory(); const data = new TextEncoder().encode('verified')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(data)))
    await expect(verifiedDownload('https://official.test/archive', '0'.repeat(64), join(dir, 'bad'), new AbortController().signal)).rejects.toThrow(/checksum/)
    await expect(readFile(join(dir, 'bad'))).rejects.toThrow()
    await verifiedDownload('https://official.test/archive', createHash('sha256').update(data).digest('hex'), join(dir, 'good'), new AbortController().signal)
    expect(await readFile(join(dir, 'good'), 'utf8')).toBe('verified')
  })
  it('extracts only the Windows executable and excludes archive paths', async () => {
    const dir = await directory(); const archive = join(dir, 'uv.zip')
    await writeFile(archive, zipSync({ 'nested/uv.exe': new TextEncoder().encode('binary'), '../unwanted': new TextEncoder().encode('bad') }))
    await extractRuntimeArchive(archive, join(dir, 'out'), true)
    expect(await readFile(join(dir, 'out/uv.exe'), 'utf8')).toBe('binary')
    await expect(readFile(join(dir, 'unwanted'))).rejects.toThrow()
  })
  it('validates card status values received over the wire', () => {
    expect(parseServiceStatus({ phase: 'ready', endpoint: 'http://localhost', message: '', logs: '' }).phase).toBe('ready')
    expect(() => parseServiceStatus({ phase: 'unexpected' })).toThrow()
    expect(() => parseServiceStatus({ phase: 'ready', endpoint: 123, message: '', logs: '' })).toThrow()
  })
  it('guards Unix account imports and logging only for Windows', async () => {
    const dir = await directory(); await mkdir(join(dir, 'searx'))
    const target = join(dir, 'searx', 'valkeydb.py')
    const original = `import os\nimport pwd\n\ndef connect():\n        _pw = pwd.getpwuid(os.getuid())\n        logger.exception("[%s (%s)] can't connect valkey DB ...", _pw.pw_name, _pw.pw_uid)\n`
    await writeFile(target, original)
    await applyWindowsCompatibility(dir, 'darwin')
    expect(await readFile(target, 'utf8')).toBe(original)
    await applyWindowsCompatibility(dir, 'win32')
    const patched = await readFile(target, 'utf8')
    expect(patched).toContain('except ImportError:\n    pwd = None')
    expect(patched).toContain('if pwd is None:')
    expect(patched).toContain('else:\n            _pw = pwd.getpwuid(os.getuid())')
  })
  it('rejects an unexpected upstream source before making a partial patch', async () => {
    const dir = await directory(); await mkdir(join(dir, 'searx'))
    const target = join(dir, 'searx', 'valkeydb.py'); await writeFile(target, 'unexpected source')
    await expect(applyWindowsCompatibility(dir, 'win32')).rejects.toThrow(/no longer matches/)
    expect(await readFile(target, 'utf8')).toBe('unexpected source')
  })
})
