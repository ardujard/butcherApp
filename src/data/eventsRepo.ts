import type { CheckpointPayload, DomainEvent, TopupPayload } from '../domain/types'
import { checkForRelevance } from '../domain/retention'
import { getDB } from './db'
import { getProduct } from './productsRepo'

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
  await pruneEventHistory(productId)
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
  await pruneEventHistory(productId)
  return result
}

/** Triggered after every new entry: discards event history a full replay
 * will never need again (see domain/retention.ts for what qualifies). */
async function pruneEventHistory(productId: string): Promise<void> {
  const product = await getProduct(productId)
  if (!product) return

  const events = await getEventsForProduct(productId)
  const prunable = checkForRelevance(events, product.category)
  if (prunable.length === 0) return

  const db = await getDB()
  const tx = db.transaction('events', 'readwrite')
  await Promise.all(prunable.map((e) => tx.store.delete(e.id)))
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
