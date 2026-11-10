import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { build, stop } from 'esbuild'

// Compiles the Free UI components (components/free) into @fetaui/react, run from packages/react:
//   node ../../scripts/build-ui-modules.mjs [--check]
// One ES module per source file under dist/esm/ui, so bundlers drop what is not imported. Each
// CSS module is compiled to scoped CSS next to its JS, and the JS imports it, so an app loads only
// the styles of the components it uses. Every package import stays external: icons resolve through
// @fetaui/react/rounded/* (this same package), React, Motion and @number-flow/react from the app.
// The public import paths, @fetaui/react/ui/<name>, are every component file outside the *-kit
// helper folders; publishConfig.exports in package.json must list exactly those (--check fails if not).

const ROOT = resolve('../..')
const SRC = join(ROOT, 'components')
const OUT = 'dist/esm/ui'
const check = process.argv.includes('--check')

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : [path]
})
const sources = walk(join(SRC, 'free')).filter((f) => /\.tsx?$/.test(f) && !/\.(test|stories)\.tsx?$/.test(f))
const isPublic = (file) => file.endsWith('.tsx') && !relative(join(SRC, 'free'), file).split('/')[0].endsWith('-kit')
const publicNames = sources.filter(isPublic).map((f) => basename(f, '.tsx')).sort()

/** The exports @fetaui/react publishes for the UI, in package.json order. */
function uiExports() {
  const entries = { './tokens.css': './dist/tokens.css' }
  for (const name of publicNames) {
    const file = sources.find((f) => isPublic(f) && basename(f, '.tsx') === name)
    const path = relative(join(SRC, 'free'), file).replace(/\.tsx$/, '')
    entries[`./ui/${name}`] = { types: `./dist/types/ui/free/${path}.d.ts`, import: `./${OUT}/free/${path}.js` }
  }
  return entries
}

// Keeps every import outside the entry file external, and points relative ones at the built .js.
const externals = {
  name: 'externals',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point' || args.path.endsWith('.module.css')) return undefined
      if (!args.path.startsWith('.')) return { path: args.path, external: true }
      const target = resolve(args.resolveDir, args.path)
      const file = ['.tsx', '.ts'].map((ext) => target + ext).find(existsSync)
      if (!file) throw new Error(`Cannot resolve ${args.path} from ${args.importer}`)
      const rel = relative(args.resolveDir, file).replace(/\.tsx?$/, '.js')
      return { path: rel.startsWith('.') ? rel : `./${rel}`, external: true }
    })
  },
}

const pkgPath = 'package.json'
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const expected = uiExports()
const current = Object.fromEntries(Object.entries(pkg.publishConfig?.exports ?? {}).filter(([k]) => k.startsWith('./ui/') || k === './tokens.css'))
if (JSON.stringify(current) !== JSON.stringify(expected)) {
  if (check) {
    console.error('package.json publishConfig.exports for the UI is out of date. Run: node ../../scripts/build-ui-modules.mjs --write-exports')
    process.exit(1)
  }
  if (process.argv.includes('--write-exports')) {
    const rest = Object.fromEntries(Object.entries(pkg.publishConfig.exports).filter(([k]) => !(k.startsWith('./ui/') || k === './tokens.css')))
    pkg.publishConfig.exports = { ...rest, ...expected }
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    console.log(`wrote ${publicNames.length} UI exports to package.json`)
  } else {
    console.error('package.json UI exports differ from components/free. Run with --write-exports to update them.')
    process.exit(1)
  }
}
if (check) process.exit(0)

rmSync(OUT, { recursive: true, force: true })
try {
  const result = await build({
    entryPoints: [...sources, join(SRC, 'motion-tokens.ts')],
    outbase: SRC, outdir: OUT,
    bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic',
    loader: { '.module.css': 'local-css' },
    plugins: [externals],
    banner: { js: '"use client";' },
    metafile: true, write: true, logLevel: 'error',
  })
  // A component with styles gets a sibling .css; its JS imports it so bundlers load it with the module.
  // The banner is the one "use client" directive; the source's own copy and esbuild's source path
  // comments are dropped, so the output names no private paths.
  const clean = (text) => text.split('\n').filter((line) => !/^(\/\/|\/\*) [^\n]*\.\.\//.test(line) && line !== '"use client";' && line !== "'use client';").join('\n')
  let styled = 0
  for (const [out, meta] of Object.entries(result.metafile.outputs)) {
    if (out.endsWith('.css')) {
      writeFileSync(out, clean(readFileSync(out, 'utf8')))
      continue
    }
    const css = meta.cssBundle ? `import ${JSON.stringify(`./${basename(meta.cssBundle)}`)};\n` : ''
    if (css) styled++
    writeFileSync(out, `"use client";\n${css}${clean(readFileSync(out, 'utf8')).replace(/^\n+/, '')}`)
  }
  mkdirSync(dirname('dist/tokens.css'), { recursive: true })
  // The source header names the private generator; the published copy gets a neutral one.
  const tokens = readFileSync(join(SRC, 'tokens.css'), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\/\n?/, '')
  writeFileSync('dist/tokens.css', `/* fetaUI design tokens. Generated, do not edit. */\n${tokens}`)
  console.log(`built ui (${sources.length} modules, ${styled} with styles, ${publicNames.length} public)`)
} finally {
  await stop()
}
