import { readdirSync, rmSync, statSync } from 'node:fs'
import { build, stop } from 'esbuild'

// Compiles generated icon modules to dist/{esm,cjs}/<style>/, one module per file so bundlers can
// drop what is not imported (ANIMATION.md §6.1). Run from a package folder: node ../../scripts/build-icon-modules.mjs
// esbuild holds every entry of a call in memory: 6,000 files in one call peak near 2.3 GB, which
// with two formats at once ran the CI runner out of memory. Batches of 500 peak near 400 MB.
const BATCH = 500
const FORMATS = ['esm', 'cjs']

const styles = readdirSync('src').filter((d) => d !== 'lib' && statSync(`src/${d}`).isDirectory())
try {
  for (const style of styles) {
    const entries = readdirSync(`src/${style}`).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => `src/${style}/${f}`)
    for (const format of FORMATS) {
      // Start empty, so a removed or reclassified icon never lingers in a published dist.
      rmSync(`dist/${format}/${style}`, { recursive: true, force: true })
      for (let i = 0; i < entries.length; i += BATCH) {
        await build({
          entryPoints: entries.slice(i, i + BATCH), outbase: `src/${style}`, outdir: `dist/${format}/${style}`,
          format, platform: 'node', jsx: 'automatic', bundle: false, write: true, logLevel: 'error',
        })
      }
    }
    console.log(`built ${style} (${entries.length} modules)`)
  }
} finally {
  await stop()
}
