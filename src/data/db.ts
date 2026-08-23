import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { DomainEvent, Label, Product } from '../domain/types'

interface ButcherAppDB extends DBSchema {
  labels: {
    key: string
    value: Label
    indexes: { 'by-name': string }
  }
  products: {
    key: string
    value: Product
    indexes: { 'by-labelId': string }
  }
  events: {
    key: number
    value: DomainEvent
    indexes: {
      'by-productId': string
      'by-productId-recordedAt': [string, string]
      'by-recordedAt': string
    }
  }
}

let dbPromise: Promise<IDBPDatabase<ButcherAppDB>> | null = null

export function getDB(): Promise<IDBPDatabase<ButcherAppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ButcherAppDB>('butcherApp', 1, {
      upgrade(db) {
        const labels = db.createObjectStore('labels', { keyPath: 'id' })
        labels.createIndex('by-name', 'name', { unique: true })

        const products = db.createObjectStore('products', { keyPath: 'id' })
        products.createIndex('by-labelId', 'labelId')
        // IndexedDB indexes can't key on booleans usefully across engines; we
        // filter archived in JS instead, so this store is intentionally kept
        // small and simple.

        const events = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true })
        events.createIndex('by-productId', 'productId')
        events.createIndex('by-productId-recordedAt', ['productId', 'recordedAt'])
        events.createIndex('by-recordedAt', 'recordedAt')
      },
    })
  }
  return dbPromise
}

/** Test-only: drops the cached connection and deletes the database so each
 * test file starts from a clean slate. */
export async function resetDBForTests(): Promise<void> {
  if (dbPromise) {
    ;(await dbPromise).close()
  }
  dbPromise = null
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('butcherApp')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}
