import { beforeEach, describe, expect, it } from 'vitest'
import { getDB, resetDBForTests } from '../db'
import {
  addCheckpoint,
  addTopup,
  countEventsSince,
  deleteEvent,
  editEvent,
  getEventsForProduct,
  getRecentEvents,
  recentProductionDates,
} from '../eventsRepo'
import { createProduct } from '../productsRepo'
import type { DomainEvent, TopupPayload } from '../../domain/types'

beforeEach(async () => {
  await resetDBForTests()
})

describe('eventsRepo', () => {
  it('logs top-ups and checkpoints', async () => {
    const product = await createProduct('Kaasburger', 'discrete', null)
    await addTopup(product.id, { productionDate: '2026-08-21', addedQty: 20, statedTotal: 20 })
    await addCheckpoint(product.id, { statedTotal: 4 })

    const events = await getEventsForProduct(product.id)
    expect(events.map((e) => e.type)).toEqual(['topup', 'checkpoint'])
  })

  it('edits a record in place, keeping an editedAt marker', async () => {
    const product = await createProduct('Kaasburger', 'discrete', null)
    const event = await addTopup(product.id, { productionDate: '2026-08-21', addedQty: 20, statedTotal: 20 })

    await editEvent(event.id, { productionDate: '2026-08-21', addedQty: 18, statedTotal: 18 })

    const [stored] = await getEventsForProduct(product.id)
    expect(stored.editedAt).toBeDefined()
    expect((stored.payload as TopupPayload).addedQty).toBe(18)
  })

  it('permanently removes a record on delete', async () => {
    const product = await createProduct('Kaasburger', 'discrete', null)
    const event = await addTopup(product.id, { productionDate: '2026-08-21', addedQty: 20, statedTotal: 20 })

    await deleteEvent(event.id)

    expect(await getEventsForProduct(product.id)).toEqual([])
  })

  it('returns the most recent events first, capped at the given limit', async () => {
    const product = await createProduct('Kaasburger', 'discrete', null)
    await addTopup(product.id, { productionDate: '2026-08-20', addedQty: 5, statedTotal: 5 })
    await addTopup(product.id, { productionDate: '2026-08-21', addedQty: 5, statedTotal: 10 })
    await addTopup(product.id, { productionDate: '2026-08-22', addedQty: 5, statedTotal: 15 })

    const recent = await getRecentEvents(product.id, 2)
    expect(recent).toHaveLength(2)
    expect((recent[0].payload as TopupPayload).productionDate).toBe('2026-08-22')
  })

  it('counts events since a cutoff via the compound index', async () => {
    const product = await createProduct('Kaasburger', 'discrete', null)
    await addTopup(product.id, { productionDate: '2026-08-21', addedQty: 5, statedTotal: 5 })

    expect(await countEventsSince(product.id, '2000-01-01T00:00:00.000Z')).toBe(1)
    expect(await countEventsSince(product.id, '2999-01-01T00:00:00.000Z')).toBe(0)
  })

  async function addOldEntry(productId: string, daysAgo: number, event: Pick<DomainEvent, 'type' | 'payload'>) {
    const db = await getDB()
    const recordedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
    await db.add('events', { productId, recordedAt, ...event } as Omit<DomainEvent, 'id'> as DomainEvent)
  }

  it('deletes entries older than 30 days once their stock is gone, when a new entry is logged', async () => {
    const product = await createProduct('Kaasburger', 'discrete', null)
    await addOldEntry(product.id, 40, { type: 'topup', payload: { productionDate: '2026-08-01', addedQty: 4, statedTotal: 4 } })
    await addOldEntry(product.id, 35, { type: 'checkpoint', payload: { statedTotal: 0 } })
    await addOldEntry(product.id, 29, { type: 'topup', payload: { productionDate: '2026-08-20', addedQty: 3, statedTotal: 3 } })

    await addTopup(product.id, { productionDate: '2026-08-30', addedQty: 2, statedTotal: 5 })

    const remaining = await getEventsForProduct(product.id)
    expect(remaining.map((e) => (e.payload as TopupPayload).productionDate)).toEqual(['2026-08-20', '2026-08-30'])
  })

  it('keeps an entry older than 30 days while its stock is still in the counter', async () => {
    const product = await createProduct('Rookworst', 'discrete', null, 'external')
    await addOldEntry(product.id, 40, { type: 'topup', payload: { productionDate: '2026-11-20', addedQty: 10, statedTotal: 10 } })

    await addTopup(product.id, { productionDate: '2026-11-30', addedQty: 10, statedTotal: 16 })

    const remaining = await getEventsForProduct(product.id)
    expect(remaining.map((e) => (e.payload as TopupPayload).productionDate)).toEqual(['2026-11-20', '2026-11-30'])
  })

  it('surfaces the most recently used distinct production dates globally', async () => {
    const p1 = await createProduct('Kaasburger', 'discrete', null)
    const p2 = await createProduct('Spek', 'discrete', null)
    await addTopup(p1.id, { productionDate: '2026-08-20', addedQty: 5, statedTotal: 5 })
    await addTopup(p2.id, { productionDate: '2026-08-20', addedQty: 5, statedTotal: 5 })
    await addTopup(p1.id, { productionDate: '2026-08-22', addedQty: 5, statedTotal: 10 })

    expect(await recentProductionDates(2)).toEqual(['2026-08-22', '2026-08-20'])
  })
})
