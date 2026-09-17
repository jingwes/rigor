/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Read the app name/version once, at config-evaluation time, straight from
// package.json (never hand-typed/duplicated) so `generateMethodsText.ts` can
// report the software name/version it actually ran, without bundling a JSON
// import (which would need `resolveJsonModule` wired through every tsconfig
// project in this repo).
const packageJson = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./package.json', import.meta.url)),
    'utf-8',
  ),
) as { name: string; version: string }

// The exact pinned Pyodide CDN origin/path this app loads at runtime (see
// `src/statistics/statistics.worker.ts`) - kept in sync by hand since the
// worker file is intentionally not imported from build config. Every file
// under this pinned, versioned `v314.0.7` path is immutable, so it is safe
// to cache indefinitely (Milestone 13: offline support, see PR description).
const PYODIDE_CDN_URL_PATTERN =
  /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v314\.0\.7\//

// https://vite.dev/config/
export default defineConfig({
  base: '/rigor/',
  plugins: [
    react(),
    VitePWA({
      // `generateSW` (the default) is Workbox's simpler, config-driven
      // strategy - no hand-written service worker source to maintain, which
      // keeps this infrastructure-only milestone from growing its own
      // cache-invalidation bugs.
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Rigor',
        short_name: 'Rigor',
        description: 'Statistics that start with your experiment.',
        start_url: '/rigor/',
        scope: '/rigor/',
        display: 'standalone',
        // Matches the light-mode palette in src/index.css (--accent / --bg).
        theme_color: '#7c3aed',
        background_color: '#ffffff',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built app shell (HTML/JS/CSS/icons) so it loads
        // offline after a first visit.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            // The pinned, versioned Pyodide/NumPy/SciPy CDN runtime
            // (jsdelivr) - immutable per-version URLs, so a long-lived
            // CacheFirst policy is correct: once fetched, a given URL's
            // response never changes, so re-validating it on every load
            // would only cost round trips for no benefit. `maxEntries` caps
            // total storage (the full Pyodide+NumPy+SciPy runtime is
            // dozens of files); `maxAgeSeconds` is a generous backstop
            // (1 year), not a real invalidation mechanism.
            urlPattern: PYODIDE_CDN_URL_PATTERN,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pyodide-runtime-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        // Keep dev server behavior unchanged (no service worker underfoot
        // while iterating) - this milestone is about the production/GitHub
        // Pages build.
        enabled: false,
      },
    }),
  ],
  define: {
    __APP_NAME__: JSON.stringify(packageJson.name),
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
