import { describe, expect, it } from 'vitest'
import {
  addedFromLeftBefore,
  daysSinceLastCheckpoint,
  isCategoryLocked,
  rowBreakdown,
  totalFromRows,
  wouldExceedFull,
} from '../reconcile'
import type { DomainEvent } from '../types'

describe('isCategoryLocked', () => {
  it('is unlocked with no history', () => {
    expect(isCategoryLocked([])).toBe(false)
  })

  it('locks once any event exists', () => {
    const events: DomainEvent[] = [
      { id: 1, productId: 'p1', type: 'topup', recordedAt: 't1', payload: { productionDate: 'd', addedQty: 1 } },
    ]
    expect(isCategoryLocked(events)).toBe(true)
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

describe('rowBreakdown', () => {
  it('splits a total into full rows and a loose remainder', () => {
    expect(rowBreakdown(19, 8)).toEqual({ rows: 2, extra: 3 })
  })

  it('handles an exact multiple of the row size', () => {
    expect(rowBreakdown(16, 8)).toEqual({ rows: 2, extra: 0 })
  })

  it('handles a total smaller than one row', () => {
    expect(rowBreakdown(3, 8)).toEqual({ rows: 0, extra: 3 })
  })
})

describe('totalFromRows', () => {
  it('recombines rows and extra back into a total', () => {
    expect(totalFromRows(2, 3, 8)).toBe(19)
  })
})

describe('addedFromLeftBefore', () => {
  it('infers the added amount from what was left and the new total', () => {
    expect(addedFromLeftBefore(15, 3)).toBe(12)
  })

  it('goes negative when the new total is less than what was left', () => {
    expect(addedFromLeftBefore(2, 3)).toBe(-1)
  })
})

describe('daysSinceLastCheckpoint', () => {
  it('returns null when there has never been a checkpoint', () => {
    expect(daysSinceLastCheckpoint([])).toBeNull()
  })

  it('counts days since the most recent checkpoint', () => {
    const events: DomainEvent[] = [
      { id: 1, productId: 'p1', type: 'checkpoint', recordedAt: '2026-08-15T08:00:00Z', payload: { statedTotal: 5 } },
      { id: 2, productId: 'p1', type: 'checkpoint', recordedAt: '2026-08-18T08:00:00Z', payload: { statedTotal: 3 } },
    ]
    const result = daysSinceLastCheckpoint(events, new Date('2026-08-23T08:00:00Z'))
    expect(result).toBe(5)
  })
})
