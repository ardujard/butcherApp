import type { CheckpointPayload, DomainEvent, TopupPayload } from '../domain/types'
import { getDB } from './db'

const RETENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export async function getEventsForProduct(productId: string): Promise<DomainEvent[]> {
  const db = await getDB()
  return db.getAllFromIndex('events', 'by-productId', productId)
}

/** Most recent events for a product, newest first, for the edit/recent-entries list. */
export async function getRecentEvents(productId: string, limit: number): Promise<DomainEvent[]> {
  const events = await getEventsForProduct(productId)
  return events
    .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : a.recordedAt > b.recordedAt ? -1 : b.id - a.id))
    .slice(0, limit)
}

/** Rolling-window use count via the compound index, without loading unrelated products. */
export async function countEventsSince(productId: string, sinceISO: string): Promise<number> {
  const db = await getDB()
  const range = IDBKeyRange.bound([productId, sinceISO], [productId, '￿'])
  return db.countFromIndex('events', 'by-productId-recordedAt', range)
}

export async function addTopup(productId: string, payload: TopupPayload): Promise<DomainEvent> {
  const db = await getDB()
  const event: Omit<DomainEvent, 'id'> = {
    productId,
    type: 'topup',
    recordedAt: new Date().toISOString(),
    payload,
  }
  const id = await db.add('events', event as DomainEvent)
  const result = { ...event, id: id as number }
  await pruneOldEvents(productId)
  return result
}

export async function addCheckpoint(productId: string, payload: CheckpointPayload): Promise<DomainEvent> {
  const db = await getDB()
  const event: Omit<DomainEvent, 'id'> = {
    productId,
    type: 'checkpoint',
    recordedAt: new Date().toISOString(),
    payload,
  }
  const id = await db.add('events', event as DomainEvent)
  const result = { ...event, id: id as number }
  await pruneOldEvents(productId)
  return result
}

/** Triggered after every new entry: hard-deletes this product's events
 * older than 30 days. The log is the live source of current stock, not
 * just an audit trail — a product that goes untouched for 30+ days will
 * have its entire history, and therefore its tracked stock, cleared with
 * it (a deliberate tradeoff for simplicity over the alternative of only
 * pruning events a full replay can prove are safe to discard). */
async function pruneOldEvents(productId: string): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_WINDOW_MS).toISOString()
  const db = await getDB()
  const range = IDBKeyRange.bound([productId, ''], [productId, cutoff], false, true)
  const tx = db.transaction('events', 'readwrite')
  let cursor = await tx.store.index('by-productId-recordedAt').openCursor(range)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function editEvent(id: number, payload: TopupPayload | CheckpointPayload): Promise<void> {
  const db = await getDB()
  const event = await db.get('events', id)
  if (!event) throw new Error(`Event ${id} not found`)
  await db.put('events', { ...event, payload, editedAt: new Date().toISOString() })
}

export async function deleteEvent(id: number): Promise<void> {
  const db = await getDB()
  await db.delete('events', id)
}

/** The `limit` most recently used production dates across all products, for
 * the global quick-pick chips (the same date is usually reused across
 * several products logged on the same working day). */
export async function recentProductionDates(limit: number): Promise<string[]> {
  if (limit <= 0) return []
  const db = await getDB()
  const events = await db.getAllFromIndex('events', 'by-recordedAt')
  const dates: string[] = []
  const seen = new Set<string>()

  for (let i = events.length - 1; i >= 0 && dates.length < limit; i--) {
    const event = events[i]
    if (event.type !== 'topup') continue
    const date = (event.payload as TopupPayload).productionDate
    if (seen.has(date)) continue
    seen.add(date)
    dates.push(date)
  }

  return dates
}
