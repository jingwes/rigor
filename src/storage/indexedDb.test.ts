import { afterEach, describe, expect, it } from 'vitest'
import { idbDelete, idbGet, idbSet, resetIndexedDbConnectionForTests } from './indexedDb'

describe('indexedDb (using the in-memory fake-indexeddb shim)', () => {
  afterEach(async () => {
    await idbDelete('test-key')
    resetIndexedDbConnectionForTests()
  })

  it('returns undefined for a key that was never set', async () => {
    expect(await idbGet('test-key')).toBeUndefined()
  })

  it('round-trips a JSON-serializable value', async () => {
    const value = { hello: 'world', nested: { count: 3, list: [1, 2, 3] } }
    await idbSet('test-key', value)
    expect(await idbGet('test-key')).toEqual(value)
  })

  it('overwrites a previous value at the same key', async () => {
    await idbSet('test-key', { version: 1 })
    await idbSet('test-key', { version: 2 })
    expect(await idbGet('test-key')).toEqual({ version: 2 })
  })

  it('actually clears storage on delete', async () => {
    await idbSet('test-key', { version: 1 })
    expect(await idbGet('test-key')).toEqual({ version: 1 })

    await idbDelete('test-key')
    expect(await idbGet('test-key')).toBeUndefined()
  })

  it('keeps different keys independent', async () => {
    await idbSet('test-key', { a: 1 })
    await idbSet('test-key-2', { b: 2 })
    expect(await idbGet('test-key')).toEqual({ a: 1 })
    expect(await idbGet('test-key-2')).toEqual({ b: 2 })
    await idbDelete('test-key-2')
  })
})
