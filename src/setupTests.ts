import '@testing-library/jest-dom/vitest'

// Milestone 12: Node/jsdom (vitest's test environment) has no real
// IndexedDB implementation - this registers a small, standard in-memory
// shim as the global `indexedDB` for every test, so `src/storage/
// indexedDb.ts`'s real `idb` calls run against something real rather than
// being mocked away.
import 'fake-indexeddb/auto'
