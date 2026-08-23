import { describe, expect, it } from 'vitest'
import { activeComposition, oldestActiveDate, replayEvents, totalActiveQty } from '../batchEngine'
import type { DomainEvent } from '../types'
import { UNKNOWN_DATE } from '../types'

let nextId = 1
function topup(
  recordedAt: string,
  productionDate: string,
  addedQty: number,
  statedTotal?: number,
): DomainEvent {
  return {
    id: nextId++,
    productId: 'p1',
    type: 'topup',
    recordedAt,
    deleted: false,
    payload: { productionDate, addedQty, statedTotal },
  }
}

function bulkTopup(recordedAt: string, productionDate: string, addedPct: number): DomainEvent {
  return {
    id: nextId++,
    productId: 'p1',
    type: 'topup',
    recordedAt,
    deleted: false,
    payload: { productionDate, addedPct },
  }
}

function checkpoint(recordedAt: string, statedTotal: number): DomainEvent {
  return {
    id: nextId++,
    productId: 'p1',
    type: 'checkpoint',
    recordedAt,
    deleted: false,
    payload: { statedTotal },
  }
}

describe('replayEvents (discrete)', () => {
  it('first-ever top-up with a matching recount yields exactly that batch', () => {
    const result = replayEvents([topup('2026-08-21T09:00:00Z', '2026-08-21', 20, 20)], 'discrete')
    expect(activeComposition(result)).toEqual([{ date: '2026-08-21', qty: 20 }])
    expect(result.unexplainedShortfall).toBe(0)
  })

  it('the running example from the spec: Friday sells down, Saturday top-up leaves both dates', () => {
    const events = [
      // Friday: produce 20, by end of day only 4 remain (16 sold)
      topup('2026-08-21T08:00:00Z', '2026-08-21', 20, 20),
      // Saturday: add 8 more; recount says 12 total now (4 old + 8 new)
      topup('2026-08-22T08:00:00Z', '2026-08-22', 8, 12),
    ]
    const result = replayEvents(events, 'discrete')
    expect(activeComposition(result)).toEqual([
      { date: '2026-08-22', qty: 8 },
      { date: '2026-08-21', qty: 4 },
    ])
    expect(totalActiveQty(result)).toBe(12)
  })

  it('a shortfall depletes pre-existing stock LIFO (newest-of-the-old first), leaving the fresh batch untouched', () => {
    const events = [
      topup('2026-08-20T08:00:00Z', '2026-08-20', 10, 10),
      topup('2026-08-21T08:00:00Z', '2026-08-21', 10, 20), // total now 20, matches
      // Saturday top-up: add 5, but recount says only 17 total (down from 20 -> 8 consumed)
      topup('2026-08-22T08:00:00Z', '2026-08-22', 5, 17),
    ]
    const result = replayEvents(events, 'discrete')
    // 8 consumed from pre-existing (10 08-20 + 10 08-21 = 20), newest-old-first: all 8 comes from 08-21
    expect(activeComposition(result)).toEqual([
      { date: '2026-08-22', qty: 5 },
      { date: '2026-08-21', qty: 2 },
      { date: '2026-08-20', qty: 10 },
    ])
    expect(result.unexplainedShortfall).toBe(0)
  })

  it('a backdated production date is treated as old even though it is entered last', () => {
    const events = [
      topup('2026-08-20T08:00:00Z', '2026-08-20', 10, 10),
      topup('2026-08-21T08:00:00Z', '2026-08-22', 5, 15),
      // staff find a forgotten tray from 08-18 and add it today
      topup('2026-08-22T08:00:00Z', '2026-08-18', 3, 18),
    ]
    const result = replayEvents(events, 'discrete')
    expect(activeComposition(result)).toEqual([
      { date: '2026-08-22', qty: 5 },
      { date: '2026-08-20', qty: 10 },
      { date: '2026-08-18', qty: 3 },
    ])
    expect(oldestActiveDate(result)).toBe('2026-08-18')
  })

  it('a shortfall exceeding all available pre-existing stock is flagged, not silently forced onto the fresh batch', () => {
    // brand-new product: nothing existed before, so a stated total below the
    // added amount is a logical impossibility, not "consumption" - surface it.
    const result = replayEvents([topup('2026-08-21T08:00:00Z', '2026-08-21', 5, 3)], 'discrete')
    expect(activeComposition(result)).toEqual([{ date: '2026-08-21', qty: 5 }])
    expect(result.unexplainedShortfall).toBe(2)
  })

  it('a surplus recount (found more than expected) is routed to the unknown bucket, never guessed', () => {
    const result = replayEvents([topup('2026-08-21T08:00:00Z', '2026-08-21', 5, 9)], 'discrete')
    const comp = activeComposition(result)
    expect(comp).toEqual([
      { date: '2026-08-21', qty: 5 },
      { date: UNKNOWN_DATE, qty: 4 },
    ])
  })

  it('editing an earlier top-up down reflects everywhere downstream via full replay, surfacing the gap as unknown surplus', () => {
    const original = [topup('2026-08-20T08:00:00Z', '2026-08-20', 10, 10), checkpoint('2026-08-21T08:00:00Z', 10)]
    const edited = [
      { ...original[0], payload: { ...original[0].payload, addedQty: 4 }, editedAt: '2026-08-22T00:00:00Z' },
      original[1],
    ]
    const result = replayEvents(edited, 'discrete')
    // checkpoint still says 10 was true, but only 4 was ever added -> 6 unattributed
    expect(result.batches[UNKNOWN_DATE]).toBe(6)
    expect(result.batches['2026-08-20']).toBe(4)
  })

  it('a soft-deleted event is excluded from replay', () => {
    const events = [
      topup('2026-08-20T08:00:00Z', '2026-08-20', 10, 10),
      { ...topup('2026-08-21T08:00:00Z', '2026-08-21', 5, 15), deleted: true, deletedAt: '2026-08-22T00:00:00Z' },
    ]
    const result = replayEvents(events, 'discrete')
    expect(activeComposition(result)).toEqual([{ date: '2026-08-20', qty: 10 }])
  })

  it('a zero-quantity top-up is a valid no-op', () => {
    const result = replayEvents([topup('2026-08-21T08:00:00Z', '2026-08-21', 0, 0)], 'discrete')
    expect(activeComposition(result)).toEqual([])
    expect(result.unexplainedShortfall).toBe(0)
  })

  it('same production date across multiple top-ups merges into one bucket', () => {
    const events = [
      topup('2026-08-21T08:00:00Z', '2026-08-21', 10, 10),
      topup('2026-08-21T14:00:00Z', '2026-08-21', 5, 15),
    ]
    const result = replayEvents(events, 'discrete')
    expect(activeComposition(result)).toEqual([{ date: '2026-08-21', qty: 15 }])
  })

  it('a checkpoint depletes newest-first and reveals the surviving date composition', () => {
    const events = [
      topup('2026-08-20T08:00:00Z', '2026-08-20', 4, 4),
      topup('2026-08-22T08:00:00Z', '2026-08-22', 8, 12),
      checkpoint('2026-08-23T08:00:00Z', 6), // 6 left out of 12 -> deplete 6 newest-first
    ]
    const result = replayEvents(events, 'discrete')
    expect(activeComposition(result)).toEqual([
      { date: '2026-08-22', qty: 2 },
      { date: '2026-08-20', qty: 4 },
    ])
  })
})

describe('replayEvents (bulk)', () => {
  it('accumulates percentage points across top-ups with no recount field', () => {
    const events = [bulkTopup('2026-08-20T08:00:00Z', '2026-08-20', 50), bulkTopup('2026-08-21T08:00:00Z', '2026-08-21', 25)]
    const result = replayEvents(events, 'bulk')
    expect(activeComposition(result)).toEqual([
      { date: '2026-08-21', qty: 25 },
      { date: '2026-08-20', qty: 50 },
    ])
  })

  it('a checkpoint depletes bulk percentage points LIFO just like discrete units', () => {
    const events = [
      bulkTopup('2026-08-20T08:00:00Z', '2026-08-20', 50),
      bulkTopup('2026-08-21T08:00:00Z', '2026-08-21', 25),
      checkpoint('2026-08-22T08:00:00Z', 40),
    ]
    const result = replayEvents(events, 'bulk')
    // deplete 35 newest-first: all 25 from 08-21, then 10 from 08-20
    expect(activeComposition(result)).toEqual([{ date: '2026-08-20', qty: 40 }])
  })
})
