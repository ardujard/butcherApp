import type { DomainEvent, Label, Product } from '../domain/types'
import { getDB } from './db'

// Bump whenever an exported field's meaning or shape changes, and add a
// migration branch below — mirrors how db.ts upgrades the local IndexedDB
// schema, but for backup files coming from an older app version.
const BACKUP_VERSION = 2

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

/** Upgrades an older backup's records to the current shape, so restoring one
 * doesn't write products missing fields the rest of the app expects. */
function migrateBackup(data: BackupData): BackupData {
  if (data.version < 2) {
    // v2 added sourceType/lifespanDays/layerSize to products (see db.ts's
    // matching IndexedDB upgrade for the same backfill on the local store).
    data = {
      ...data,
      products: data.products.map((p) => ({
        ...p,
        sourceType: p.sourceType ?? 'in house',
        lifespanDays: p.lifespanDays ?? null,
        layerSize: p.layerSize ?? null,
      })),
    }
  }
  return data
}

/** Parses and shape-checks an uploaded backup file's text before it's trusted
 * as an import source, migrating older backup versions to the current shape. */
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
    typeof (data as BackupData).version !== 'number' ||
    !Array.isArray((data as BackupData).labels) ||
    !Array.isArray((data as BackupData).products) ||
    !Array.isArray((data as BackupData).events)
  ) {
    throw new Error('This file does not look like a Stock Tracker backup.')
  }
  const backup = data as BackupData
  if (backup.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Update the app before restoring it.')
  }
  return migrateBackup(backup)
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
