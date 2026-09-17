// Milestone 13 (PWA/offline support): a small, repeatable check that the
// production build actually produced a correctly-scoped web app manifest
// and a service worker whose precache manifest includes the app shell.
//
// This is deliberately a plain Node script (not a Vitest test) because it
// asserts on `dist/`, i.e. the output of `npm run build` - Vitest's suite
// runs against source and never builds first. Run with:
//   npm run build && node scripts/verify-pwa-build.mjs
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')

const BASE = '/rigor/'

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exitCode = 1
}

function ok(message) {
  console.log(`OK: ${message}`)
}

if (!existsSync(distDir)) {
  fail(`dist/ not found - run "npm run build" first.`)
  process.exit(1)
}

// --- manifest.webmanifest ---------------------------------------------------

const manifestPath = join(distDir, 'manifest.webmanifest')
if (!existsSync(manifestPath)) {
  fail('dist/manifest.webmanifest is missing.')
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  if (manifest.name === 'Rigor') ok('manifest name is "Rigor".')
  else fail(`manifest name is "${manifest.name}", expected "Rigor".`)

  if (manifest.start_url === BASE) ok(`manifest start_url is "${BASE}".`)
  else
    fail(`manifest start_url is "${manifest.start_url}", expected "${BASE}".`)

  if (manifest.scope === BASE) ok(`manifest scope is "${BASE}".`)
  else fail(`manifest scope is "${manifest.scope}", expected "${BASE}".`)

  if (manifest.display === 'standalone') ok('manifest display is "standalone".')
  else fail(`manifest display is "${manifest.display}", expected "standalone".`)

  const sizes = new Set((manifest.icons ?? []).map((icon) => icon.sizes))
  for (const required of ['192x192', '512x512']) {
    if (sizes.has(required)) ok(`manifest declares a ${required} icon.`)
    else fail(`manifest is missing a ${required} icon.`)
  }
  const hasMaskable = (manifest.icons ?? []).some(
    (icon) => icon.purpose === 'maskable',
  )
  if (hasMaskable) ok('manifest declares a maskable icon.')
  else fail('manifest is missing a maskable icon.')

  for (const icon of manifest.icons ?? []) {
    const iconPath = join(distDir, icon.src)
    if (existsSync(iconPath)) ok(`icon file exists on disk: ${icon.src}`)
    else
      fail(
        `icon file referenced by the manifest is missing on disk: ${icon.src}`,
      )
  }
}

// --- index.html --------------------------------------------------------------

const indexPath = join(distDir, 'index.html')
if (!existsSync(indexPath)) {
  fail('dist/index.html is missing.')
} else {
  const html = readFileSync(indexPath, 'utf-8')
  if (html.includes(`href="${BASE}manifest.webmanifest"`)) {
    ok(`index.html links the manifest at the "${BASE}" base path.`)
  } else {
    fail(
      `index.html does not link "${BASE}manifest.webmanifest" - check the <link rel="manifest"> tag.`,
    )
  }
}

// --- service worker + precache manifest --------------------------------------

const swPath = join(distDir, 'sw.js')
if (!existsSync(swPath)) {
  fail('dist/sw.js is missing.')
} else {
  const sw = readFileSync(swPath, 'utf-8')
  ok('dist/sw.js exists.')

  const expectedShellFiles = ['index.html', 'manifest.webmanifest']
  for (const file of expectedShellFiles) {
    if (sw.includes(`"${file}"`) || sw.includes(`url:"${file}"`)) {
      ok(`service worker precache manifest references "${file}".`)
    } else {
      fail(`service worker precache manifest does not reference "${file}".`)
    }
  }

  // At least one hashed JS asset and one CSS asset from the app shell.
  if (/assets\/index-[^"]+\.js/.test(sw))
    ok('service worker precaches the main JS bundle.')
  else fail('service worker does not precache a main JS bundle under assets/.')

  if (/assets\/index-[^"]+\.css/.test(sw))
    ok('service worker precaches the main CSS bundle.')
  else fail('service worker does not precache a main CSS bundle under assets/.')

  // The Pyodide/SciPy CDN runtime-caching rule (Milestone 13 section 4).
  // The URL pattern is serialized as a regex literal, so jsdelivr's dots are
  // backslash-escaped in the built output (e.g. "cdn\.jsdelivr\.net") -
  // match on the unescaped substring instead of the literal domain.
  if (
    sw.includes('jsdelivr') &&
    sw.includes('pyodide-runtime-cache') &&
    sw.includes('CacheFirst')
  ) {
    ok(
      'service worker registers a CacheFirst runtime-caching route for the pinned Pyodide CDN origin.',
    )
  } else {
    fail(
      'service worker is missing the expected Pyodide CDN runtime-caching route.',
    )
  }
}

if (process.exitCode === 1) {
  console.error('\nverify-pwa-build: one or more checks failed.')
  process.exit(1)
} else {
  console.log('\nverify-pwa-build: all checks passed.')
}
