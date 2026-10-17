import { describe, expect, it } from 'vitest'
import {
  batchExpiry,
  expiryNoteLabel,
  lifespanStatus,
  soonestBatchExpiry,
  sortByLifespanRemaining,
  sortOldestFirst,
  type OldestItemEntry,
} from '../dashboard'
import { UNKNOWN_DATE, type ReplayResult } from '../types'

function entry(overrides: Partial<OldestItemEntry> = {}): OldestItemEntry {
  return {
    productId: 'p1',
    productName: 'Product',
    sourceType: 'in house',
    oldestDate: null,
    lifespanDays: null,
    daysRemaining: null,
    expiryDate: null,
    expiryReason: null,
    ...overrides,
  }
}

const inHouse = (lifespanDays: number | null) => ({ sourceType: 'in house' as const, lifespanDays })
const external = (lifespanDays: number | null) => ({ sourceType: 'external' as const, lifespanDays })

function replay(batches: Record<string, number>, openedOn: Record<string, string> = {}): ReplayResult {
  return { batches, openedOn, unexplainedShortfall: 0 }
}

describe('lifespanStatus', () => {
  it('is null when lifespan is not tracked', () => {
    expect(lifespanStatus(null)).toBeNull()
  })

  it('is exceeded once days remaining hits zero or below', () => {
    expect(lifespanStatus(0)).toBe('exceeded')
    expect(lifespanStatus(-2)).toBe('exceeded')
  })

  it('is a warning within the fixed warning window', () => {
    expect(lifespanStatus(1)).toBe('warning')
  })

  it('is ok well before the limit', () => {
    expect(lifespanStatus(5)).toBe('ok')
  })
})

describe('sortOldestFirst', () => {
  it('sorts by oldest date first, undated entries last', () => {
    const entries = [
      entry({ productId: 'a', oldestDate: '2026-08-20' }),
      entry({ productId: 'b', oldestDate: null }),
      entry({ productId: 'c', oldestDate: '2026-08-10' }),
    ]
    expect(sortOldestFirst(entries).map((e) => e.productId)).toEqual(['c', 'a', 'b'])
  })
})

describe('sortByLifespanRemaining', () => {
  it('sorts by soonest to exceed lifespan first, untracked entries last', () => {
    const entries = [
      entry({ productId: 'a', daysRemaining: 3 }),
      entry({ productId: 'b', daysRemaining: null }),
      entry({ productId: 'c', daysRemaining: -1 }),
    ]
    expect(sortByLifespanRemaining(entries).map((e) => e.productId)).toEqual(['c', 'a', 'b'])
  })

  it('mixes in-house lifespan and external good-till days remaining on the same scale', () => {
    const entries = [
      entry({ productId: 'a', sourceType: 'in house', daysRemaining: 3 }),
      entry({ productId: 'b', sourceType: 'external', daysRemaining: 1 }),
      entry({ productId: 'c', sourceType: 'external', daysRemaining: -1 }),
    ]
    expect(sortByLifespanRemaining(entries).map((e) => e.productId)).toEqual(['c', 'b', 'a'])
  })
})

describe('batchExpiry (in house)', () => {
  it('counts the lifespan forward from the production date', () => {
    expect(batchExpiry('2026-08-21', '2026-08-21', inHouse(3))).toEqual({
      batchKey: '2026-08-21',
      date: '2026-08-24',
      reason: 'shelf',
    })
  })

  it('is untracked when the product has no lifespan', () => {
    expect(batchExpiry('2026-08-21', '2026-08-21', inHouse(null))).toBeNull()
  })

  it('is untracked for the unattributable bucket, which has no date to count from', () => {
    expect(batchExpiry(UNKNOWN_DATE, undefined, inHouse(3))).toBeNull()
  })
})

describe('batchExpiry (external)', () => {
  it('falls back to the good-till date when no counter window is set', () => {
    expect(batchExpiry('2026-12-02', '2026-10-14', external(null))).toEqual({
      batchKey: '2026-12-02',
      date: '2026-12-02',
      reason: 'shelf',
    })
  })

  it('lets the counter window overtake a distant good-till date', () => {
    expect(batchExpiry('2026-12-02', '2026-10-14', external(3))).toEqual({
      batchKey: '2026-12-02',
      date: '2026-10-17',
      reason: 'counter',
    })
  })

  it('keeps the good-till date when it falls inside the counter window', () => {
    expect(batchExpiry('2026-10-15', '2026-10-14', external(3))).toEqual({
      batchKey: '2026-10-15',
      date: '2026-10-15',
      reason: 'shelf',
    })
  })

  it('reports the good-till date when the two limits land on the same day', () => {
    expect(batchExpiry('2026-10-17', '2026-10-14', external(3))?.reason).toBe('shelf')
  })

  it('falls back to the good-till date when the batch has no recorded top-up', () => {
    expect(batchExpiry('2026-12-02', undefined, external(3))).toEqual({
      batchKey: '2026-12-02',
      date: '2026-12-02',
      reason: 'shelf',
    })
  })
})

describe('soonestBatchExpiry', () => {
  it('picks the batch expiring soonest even when it is not the oldest one', () => {
    const result = replay({ '2026-12-02': 8, '2026-10-20': 5 }, { '2026-12-02': '2026-10-14' })
    expect(soonestBatchExpiry(result, external(3))).toEqual({
      batchKey: '2026-12-02',
      date: '2026-10-17',
      reason: 'counter',
    })
  })

  it('ignores depleted batches', () => {
    const result = replay({ '2026-12-02': 0, '2026-10-20': 5 }, { '2026-12-02': '2026-10-14' })
    expect(soonestBatchExpiry(result, external(3))?.date).toBe('2026-10-20')
  })

  it('ignores the unattributable bucket', () => {
    expect(soonestBatchExpiry(replay({ [UNKNOWN_DATE]: 5 }), external(3))).toBeNull()
  })

  it('is null when nothing is tracked', () => {
    expect(soonestBatchExpiry(replay({ '2026-08-21': 5 }), inHouse(null))).toBeNull()
  })
})

describe('expiryNoteLabel', () => {
  const from = new Date('2026-10-17T10:00:00Z')
  const counter = { batchKey: '2026-12-02', date: '2026-10-19', reason: 'counter' as const }

  it('names the limit and the deadline', () => {
    expect(expiryNoteLabel(counter, 2, from)).toBe('toonbank t/m 19/10 · nog 2 dagen')
  })

  it('spells out today and tomorrow instead of a bare date', () => {
    expect(expiryNoteLabel(counter, 0, from)).toBe('toonbank t/m vandaag')
    expect(expiryNoteLabel(counter, 1, from)).toBe('toonbank t/m morgen')
  })

  it('counts up once the deadline has passed', () => {
    expect(expiryNoteLabel(counter, -1, from)).toBe('toonbank · 1 dag te laat')
    expect(expiryNoteLabel(counter, -3, from)).toBe('toonbank · 3 dagen te laat')
  })

  it('drops the date when it just repeats the batch date already on screen', () => {
    const shelf = { batchKey: '2026-12-02', date: '2026-12-02', reason: 'shelf' as const }
    expect(expiryNoteLabel(shelf, 46, from)).toBe('houdbaar · nog 46 dagen')
  })
})
