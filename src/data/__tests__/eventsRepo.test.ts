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

  it('deletes a product\'s events older than 30 days when a new entry is logged', async () => {
    const product = await createProduct('Kaasburger', 'discrete', null)
    const db = await getDB()

    const overThirtyDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const underThirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString()
    await db.add('events', {
      productId: product.id,
      type: 'topup',
      recordedAt: overThirtyDaysAgo,
      payload: { productionDate: overThirtyDaysAgo.slice(0, 10), addedQty: 4 },
    } as Omit<DomainEvent, 'id'> as DomainEvent)
    await db.add('events', {
      productId: product.id,
      type: 'topup',
      recordedAt: underThirtyDaysAgo,
      payload: { productionDate: underThirtyDaysAgo.slice(0, 10), addedQty: 3 },
    } as Omit<DomainEvent, 'id'> as DomainEvent)

    await addTopup(product.id, { productionDate: '2026-08-30', addedQty: 2 })

    const remaining = await getEventsForProduct(product.id)
    expect(remaining.map((e) => (e.payload as TopupPayload).productionDate)).toEqual([
      underThirtyDaysAgo.slice(0, 10),
      '2026-08-30',
    ])
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
