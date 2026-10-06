/**
 * Standalone dual-face build for dsh-web-search-searxng: the Node half (the
 * search provider plugin) and the browser half (the Plugins-page settings
 * card). The card's externals are the web shell's platform module table — those
 * imports resolve through the loader at runtime, so they must stay imports;
 * everything else inlines.
 */
import type { UserConfig } from 'tsdown'

const id = 'dsh-web-search-searxng'

/** The web shell's seeded module table (PLATFORM_MODULES): importable at runtime without bundling. */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** Production dependencies and peers stay imports in the Node half; it runs from a real install. */
const HOST_EXTERNALS = [
  /^@deepseek-ai\/cordis/,
  /^@deepseek-ai\/schemastery/,
  /^@deepseek-ai\/dsh-launch-environment/,
  /^@deepseek-ai\/dsh-web/,
]

const host: UserConfig = {
  name: id,
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: true,
  clean: true,
  deps: {
    neverBundle: (specifier: string) => HOST_EXTERNALS.some(pattern => pattern.test(specifier)),
  },
}

const client: UserConfig = {
  name: `${id}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  fixedExtension: false,
  // Types ship from `tsc -p tsconfig.client.json`; a dts here would wrap the
  // module-loader banner/footer into the declaration file and break parsing.
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: (specifier: string) => PLATFORM_MODULES.includes(specifier),
  },
  inputOptions: {
    resolve: {
      conditionNames: [
        (process.env.NODE_ENV ?? 'production') === 'development' ? 'development' : 'production',
        'browser', 'import', 'module', 'default',
      ],
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    chunkFileNames: 'client.[name].js',
    sourcemapExcludeSources: false,
    banner: (chunk) => chunk.isEntry
      ? `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`
      : `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, chunk: ${JSON.stringify(chunk.fileName)}, factory: (require) => {`,
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
}

export default [host, client]
