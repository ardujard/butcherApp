import { describe, expect, it } from 'vitest'
import {
  batchDetailLabel,
  batchExpiry,
  expiryExplanation,
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
    expiry: null,
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
      openedOn: '2026-08-21',
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
      openedOn: '2026-10-14',
      date: '2026-12-02',
      reason: 'shelf',
    })
  })

  it('lets the counter window overtake a distant good-till date', () => {
    expect(batchExpiry('2026-12-02', '2026-10-14', external(3))).toEqual({
      batchKey: '2026-12-02',
      openedOn: '2026-10-14',
      date: '2026-10-17',
      reason: 'counter',
    })
  })

  it('keeps the good-till date when it falls inside the counter window', () => {
    expect(batchExpiry('2026-10-15', '2026-10-14', external(3))).toEqual({
      batchKey: '2026-10-15',
      openedOn: '2026-10-14',
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
      openedOn: null,
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
      openedOn: '2026-10-14',
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
describe('expiryExplanation', () => {
  it('spells out the counter window, and what the packaging claimed', () => {
    expect(
      expiryExplanation({
        sourceType: 'external',
        lifespanDays: 3,
        expiry: { batchKey: '2026-12-02', openedOn: '2026-10-13', date: '2026-10-16', reason: 'counter' },
      }),
    ).toBe(
      'Dit product werd aangevuld op 13/10 en staat ingesteld op max 3 dagen in de toog, ' +
        'dus tot 16/10. De houdbaarheidsdatum van de verpakking was 02/12.',
    )
  })

  it('points at the good-till date when that is the binding limit', () => {
    expect(
      expiryExplanation({
        sourceType: 'external',
        lifespanDays: 3,
        expiry: { batchKey: '2026-10-19', openedOn: '2026-10-17', date: '2026-10-19', reason: 'shelf' },
      }),
    ).toBe('Dit product heeft maar een houdbaarheid tot 19/10. Het werd aangevuld op 17/10.')
  })

  it('counts from the production date for in-house stock', () => {
    expect(
      expiryExplanation({
        sourceType: 'in house',
        lifespanDays: 3,
        expiry: { batchKey: '2026-10-13', openedOn: '2026-10-13', date: '2026-10-16', reason: 'shelf' },
      }),
    ).toBe('Dit product is geproduceerd op 13/10 en is 3 dagen houdbaar, dus tot 16/10.')
  })

  it('has nothing to explain when no limit is tracked', () => {
    expect(expiryExplanation({ sourceType: 'in house', lifespanDays: null, expiry: null })).toBeNull()
  })
})

describe('batchDetailLabel', () => {
  it('names the production date for in-house stock', () => {
    expect(batchDetailLabel('2026-10-13', 'in house', null, null)).toBe('Productiedatum: 13/10')
  })

  it('names the original good-till date for external stock', () => {
    expect(batchDetailLabel('2026-12-02', 'external', null, 46)).toBe('Originele houdbaarheidsdatum: 02/12')
  })

  it('adds how long it may stay out once a lifespan is configured', () => {
    expect(batchDetailLabel('2026-10-13', 'in house', 3, 2)).toBe(
      'Productiedatum: 13/10, kan nog 2 dagen in de toog blijven liggen',
    )
    expect(batchDetailLabel('2026-12-02', 'external', 3, 1)).toBe(
      'Originele houdbaarheidsdatum: 02/12, kan nog 1 dag in de toog blijven liggen',
    )
  })

  it('switches to an instruction once the time is up', () => {
    expect(batchDetailLabel('2026-10-13', 'in house', 3, 0)).toBe('Productiedatum: 13/10, moet vandaag uit de toog')
    expect(batchDetailLabel('2026-10-13', 'in house', 3, -1)).toBe(
      'Productiedatum: 13/10, moest 1 dag geleden al uit de toog',
    )
    expect(batchDetailLabel('2026-10-13', 'in house', 3, -4)).toBe(
      'Productiedatum: 13/10, moest 4 dagen geleden al uit de toog',
    )
  })
})
