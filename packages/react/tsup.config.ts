import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig, type Options } from 'tsup'

// Icon modules are built by scripts/build-icon-modules.mjs in batches: tsup ran out of memory on CI.
const FORMATS = [{ format: 'esm', dir: 'esm' }, { format: 'cjs', dir: 'cjs' }] as const

const lib = FORMATS.map(({ format, dir }): Options => ({
  entry: { index: 'src/lib/index.ts' },
  format, outDir: `dist/${dir}/lib`, bundle: true, dts: false, clean: false, splitting: false,
  // The motion specs are inlined; nothing else from core may ship.
  noExternal: ['@fetaui/core'], external: ['react', 'react/jsx-runtime', 'motion'],
  outExtension: () => ({ js: '.js' }),
  banner: { js: '"use client";' },
  esbuildOptions: (o) => { o.jsx = 'automatic' },
  onSuccess: async () => {
    mkdirSync('dist/cjs', { recursive: true })
    writeFileSync('dist/cjs/package.json', '{ "type": "commonjs" }\n')
    copyFileSync('../../LICENSES/THIRD-PARTY-NOTICES.txt', 'THIRD-PARTY-NOTICES.txt')
  },
}))

export default defineConfig(lib)
