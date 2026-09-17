/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

/**
 * Injected by `vite.config.ts`'s `define`, straight from `package.json` at
 * build/test time. Used only for honest, non-invented "which software
 * produced this" reporting (methods text, project export, printable report)
 * - never hand-typed/duplicated elsewhere.
 */
declare const __APP_NAME__: string
declare const __APP_VERSION__: string
