import type { DomainEvent, Label, Product } from '../domain/types'
import { getDB } from './db'

const BACKUP_VERSION = 1

export interface BackupData {
  version: number
  exportedAt: string
  labels: Label[]
  products: Product[]
  events: DomainEvent[]
}

export async function exportBackup(): Promise<BackupData> {
  const db = await getDB()
  const [labels, products, events] = await Promise.all([
    db.getAll('labels'),
    db.getAll('products'),
    db.getAll('events'),
  ])
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), labels, products, events }
}

/** Parses and shape-checks an uploaded backup file's text before it's trusted
 * as an import source. */
export function parseBackup(text: string): BackupData {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Not a valid JSON file.')
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    !Array.isArray((data as BackupData).labels) ||
    !Array.isArray((data as BackupData).products) ||
    !Array.isArray((data as BackupData).events)
  ) {
    throw new Error('This file does not look like a Stock Tracker backup.')
  }
  return data as BackupData
}

/** Replaces all local data with the contents of a backup, in one
 * transaction so a mid-import failure can't leave the database half
 * emptied. */
export async function importBackup(data: BackupData): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['labels', 'products', 'events'], 'readwrite')
  const labels = tx.objectStore('labels')
  const products = tx.objectStore('products')
  const events = tx.objectStore('events')

  await Promise.all([labels.clear(), products.clear(), events.clear()])
  await Promise.all([
    ...data.labels.map((l) => labels.put(l)),
    ...data.products.map((p) => products.put(p)),
    ...data.events.map((e) => events.put(e)),
  ])
  await tx.done
}
