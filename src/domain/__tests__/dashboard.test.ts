import { describe, expect, it } from 'vitest'
import { lifespanStatus, sortByLifespanRemaining, sortOldestFirst, type OldestItemEntry } from '../dashboard'

function entry(overrides: Partial<OldestItemEntry> = {}): OldestItemEntry {
  return {
    productId: 'p1',
    productName: 'Product',
    sourceType: 'in house',
    oldestDate: null,
    lifespanDays: null,
    daysRemaining: null,
    ...overrides,
  }
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
