/**
 * Milestone 12: a thin, generic IndexedDB key-value wrapper, built on the
 * small `idb` library (this is the one new runtime dependency this
 * milestone adds - see the milestone report for why). This module knows
 * nothing about `RigorProject` or any other app-specific shape; it only
 * stores/retrieves opaque JSON-serializable values by string key, so it is
 * independently unit-testable (with the `fake-indexeddb` in-memory shim,
 * used only in tests) without depending on the rest of the app.
 *
 * IndexedDB is a browser-local database with no network component -
 * everything in this module stays entirely on the student's own device.
 * Nothing here ever makes a network request.
 */
import { openDB, type IDBPDatabase } from 'idb'

const DATABASE_NAME = 'rigor-local-storage'
const DATABASE_VERSION = 1
const STORE_NAME = 'keyValueStore'

let dbPromise: Promise<IDBPDatabase> | undefined

function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
  return dbPromise
}

/**
 * Test-only escape hatch: forces the next call to reopen a fresh connection.
 * Needed because `fake-indexeddb` is reset between test files/cases while
 * this module's cached `dbPromise` otherwise would not be.
 */
export function resetIndexedDbConnectionForTests(): void {
  dbPromise = undefined
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  return (await db.get(STORE_NAME, key)) as T | undefined
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, value, key)
}

export async function idbDelete(key: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, key)
}
