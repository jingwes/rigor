/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Read the app name/version once, at config-evaluation time, straight from
// package.json (never hand-typed/duplicated) so `generateMethodsText.ts` can
// report the software name/version it actually ran, without bundling a JSON
// import (which would need `resolveJsonModule` wired through every tsconfig
// project in this repo).
const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { name: string; version: string }

// https://vite.dev/config/
export default defineConfig({
  base: '/rigor/',
  plugins: [react()],
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
