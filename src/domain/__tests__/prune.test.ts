import { describe, expect, it } from 'vitest'
import { replayEvents } from '../batchEngine'
import { prunableEvents, sameCounterState } from '../prune'
import type { Category, DomainEvent } from '../types'

const CUTOFF = '2026-10-01T00:00:00.000Z'

let nextId = 1
function topup(recordedAt: string, productionDate: string, addedQty: number, statedTotal?: number): DomainEvent {
  return { id: nextId++, productId: 'p1', type: 'topup', recordedAt, payload: { productionDate, addedQty, statedTotal } }
}
function bulkTopup(recordedAt: string, productionDate: string, addedPct: number): DomainEvent {
  return { id: nextId++, productId: 'p1', type: 'topup', recordedAt, payload: { productionDate, addedPct } }
}
function checkpoint(recordedAt: string, statedTotal: number): DomainEvent {
  return { id: nextId++, productId: 'p1', type: 'checkpoint', recordedAt, payload: { statedTotal } }
}

/** Prunes and checks the one promise pruning makes: the counter looks the same. */
function prune(events: DomainEvent[], category: Category = 'discrete'): DomainEvent[] {
  const pruned = prunableEvents(events, category, CUTOFF)
  const kept = events.filter((e) => !pruned.includes(e))
  expect(sameCounterState(replayEvents(kept, category), replayEvents(events, category))).toBe(true)
  return pruned
}

describe('prunableEvents', () => {
  it('keeps an old top-up whose stock is still in the counter, so it keeps its date', () => {
    const old = topup('2026-09-10T08:00:00Z', '2026-11-20', 10, 10)
    const recent = topup('2026-10-12T08:00:00Z', '2026-11-30', 10, 16)
    expect(prune([old, recent])).toEqual([])
  })

  it('deletes old entries once their stock is gone', () => {
    const old = topup('2026-09-10T08:00:00Z', '2026-11-20', 10, 10)
    const emptied = checkpoint('2026-09-20T08:00:00Z', 0)
    const recent = topup('2026-10-12T08:00:00Z', '2026-11-30', 10, 10)
    expect(prune([old, emptied, recent])).toEqual([old, emptied])
  })

  it('deletes an old top-up that FIFO has fully sold through, while its successor stays', () => {
    const oldest = topup('2026-09-01T08:00:00Z', '2026-09-01', 10, 10)
    const next = topup('2026-09-05T08:00:00Z', '2026-09-05', 10, 20)
    const recount = checkpoint('2026-10-05T08:00:00Z', 8)
    const pruned = prune([oldest, next, recount])
    expect(pruned).toContain(oldest)
    expect(pruned).not.toContain(next)
  })

  it('never touches entries recorded after the cutoff, even irrelevant ones', () => {
    const a = checkpoint('2026-10-02T08:00:00Z', 5)
    const b = checkpoint('2026-10-03T08:00:00Z', 5)
    expect(prune([a, b])).toEqual([])
  })

  it('drops only one of two identical recounts, since together they still matter', () => {
    const stock = topup('2026-09-01T08:00:00Z', '2026-09-01', 10, 10)
    const a = checkpoint('2026-09-10T08:00:00Z', 5)
    const b = checkpoint('2026-09-11T08:00:00Z', 5)
    const pruned = prune([stock, a, b])
    expect(pruned).toHaveLength(1)
  })

  it('keeps unaccounted-for stock that an old recount introduced', () => {
    const surplus = checkpoint('2026-09-10T08:00:00Z', 4)
    const recent = topup('2026-10-12T08:00:00Z', '2026-10-12', 10)
    expect(prune([surplus, recent])).toEqual([])
  })

  it('may delete an entry that once produced a shortfall, as no screen shows the tally', () => {
    const stock = topup('2026-09-01T08:00:00Z', '2026-09-01', 5, 5)
    const overclaim = checkpoint('2026-09-02T08:00:00Z', 0)
    const impossible = checkpoint('2026-09-03T08:00:00Z', 0)
    const recent = topup('2026-10-12T08:00:00Z', '2026-10-12', 10, 10)
    expect(prune([stock, overclaim, impossible, recent])).toEqual([stock, overclaim, impossible])
  })

  it('keeps a diluted bulk batch that is still a share of the container', () => {
    const old = bulkTopup('2026-09-01T08:00:00Z', '2026-09-01', 100)
    const recent = bulkTopup('2026-10-12T08:00:00Z', '2026-10-12', 40)
    expect(prune([old, recent], 'bulk')).toEqual([])
  })

  it('deletes bulk history once a full 100% top-up replaced it', () => {
    const old = bulkTopup('2026-09-01T08:00:00Z', '2026-09-01', 100)
    const replaced = bulkTopup('2026-09-15T08:00:00Z', '2026-09-15', 100)
    const recent = bulkTopup('2026-10-12T08:00:00Z', '2026-10-12', 40)
    expect(prune([old, replaced, recent], 'bulk')).toEqual([old])
  })
})

describe('sameCounterState', () => {
  it('treats a batch at 0 the same as a batch that is absent', () => {
    expect(
      sameCounterState(
        { batches: { '2026-09-01': 0, '2026-10-01': 5 }, openedOn: { '2026-09-01': '2026-09-01', '2026-10-01': '2026-10-01' }, unexplainedShortfall: 0 },
        { batches: { '2026-10-01': 5 }, openedOn: { '2026-10-01': '2026-10-01' }, unexplainedShortfall: 2 },
      ),
    ).toBe(true)
  })

  it('differs when stock in the counter would get a different top-up day', () => {
    expect(
      sameCounterState(
        { batches: { '2026-12-01': 5 }, openedOn: { '2026-12-01': '2026-09-01' }, unexplainedShortfall: 0 },
        { batches: { '2026-12-01': 5 }, openedOn: { '2026-12-01': '2026-10-01' }, unexplainedShortfall: 0 },
      ),
    ).toBe(false)
  })

  it('tolerates floating-point noise in diluted bulk shares', () => {
    expect(
      sameCounterState(
        { batches: { a: 17.857142857142858 }, openedOn: { a: 'x' }, unexplainedShortfall: 0 },
        { batches: { a: 17.857142857142854 }, openedOn: { a: 'x' }, unexplainedShortfall: 0 },
      ),
    ).toBe(true)
  })
})
