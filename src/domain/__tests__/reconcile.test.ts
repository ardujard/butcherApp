import { describe, expect, it } from 'vitest'
import { daysSinceLastCheckpoint, isCategoryLocked, wouldExceedFull } from '../reconcile'
import type { DomainEvent } from '../types'

describe('isCategoryLocked', () => {
  it('is unlocked with no history', () => {
    expect(isCategoryLocked([])).toBe(false)
  })

  it('locks once any non-deleted event exists', () => {
    const events: DomainEvent[] = [
      { id: 1, productId: 'p1', type: 'topup', recordedAt: 't1', deleted: false, payload: { productionDate: 'd', addedQty: 1 } },
    ]
    expect(isCategoryLocked(events)).toBe(true)
  })

  it('stays unlocked if the only event was deleted', () => {
    const events: DomainEvent[] = [
      { id: 1, productId: 'p1', type: 'topup', recordedAt: 't1', deleted: true, payload: { productionDate: 'd', addedQty: 1 } },
    ]
    expect(isCategoryLocked(events)).toBe(false)
  })
})

describe('wouldExceedFull', () => {
  it('flags a bulk top-up that would push the total past 100%', () => {
    expect(wouldExceedFull(80, 30)).toBe(true)
  })

  it('allows a top-up landing exactly at 100%', () => {
    expect(wouldExceedFull(75, 25)).toBe(false)
  })
})

describe('daysSinceLastCheckpoint', () => {
  it('returns null when there has never been a checkpoint', () => {
    expect(daysSinceLastCheckpoint([])).toBeNull()
  })

  it('counts days since the most recent checkpoint', () => {
    const events: DomainEvent[] = [
      { id: 1, productId: 'p1', type: 'checkpoint', recordedAt: '2026-08-15T08:00:00Z', deleted: false, payload: { statedTotal: 5 } },
      { id: 2, productId: 'p1', type: 'checkpoint', recordedAt: '2026-08-18T08:00:00Z', deleted: false, payload: { statedTotal: 3 } },
    ]
    const result = daysSinceLastCheckpoint(events, new Date('2026-08-23T08:00:00Z'))
    expect(result).toBe(5)
  })
})
