import { describe, expect, it } from 'vitest'
import { checkForRelevance } from '../retention'
import type { DomainEvent } from '../types'

const NOW = new Date('2026-08-30T12:00:00.000Z')

let nextId = 1
function topup(recordedAt: string, addedQty: number, statedTotal?: number): DomainEvent {
  return {
    id: nextId++,
    productId: 'p1',
    type: 'topup',
    recordedAt,
    payload: { productionDate: recordedAt.slice(0, 10), addedQty, statedTotal },
  }
}

function bulkTopup(recordedAt: string, addedPct: number): DomainEvent {
  return {
    id: nextId++,
    productId: 'p1',
    type: 'topup',
    recordedAt,
    payload: { productionDate: recordedAt.slice(0, 10), addedPct },
  }
}

function checkpoint(recordedAt: string, statedTotal: number): DomainEvent {
  return { id: nextId++, productId: 'p1', type: 'checkpoint', recordedAt, payload: { statedTotal } }
}

describe('checkForRelevance', () => {
  it('the exact spec example: a fully-explained top-up two levels back prunes everything older than it', () => {
    const event1 = topup('2026-08-30T08:00:00.000Z', 3) // < 24h old, protected
    const event2 = topup('2026-08-28T08:00:00.000Z', 12, 12) // self-defining: nothing existed before it
    const event3 = topup('2026-08-27T08:00:00.000Z', 5, 5)
    const event4 = topup('2026-08-26T08:00:00.000Z', 4, 4)
    const event5 = topup('2026-08-25T08:00:00.000Z', 10, 10)

    const prunable = checkForRelevance([event1, event2, event3, event4, event5], 'discrete', NOW)

    expect(prunable.map((e) => e.id)).toEqual([event5.id, event4.id, event3.id])
  })

  it('keeps everything when no event within the last 24h would even be considered, but no anchor exists further back', () => {
    // Ordinary incremental top-ups (no recount), so none of them alone
    // explain the state without what came before.
    const events = [
      topup('2026-08-28T08:00:00.000Z', 5),
      topup('2026-08-27T08:00:00.000Z', 5),
      topup('2026-08-26T08:00:00.000Z', 5),
    ]

    expect(checkForRelevance(events, 'discrete', NOW)).toEqual([])
  })

  it('a zero checkpoint anchors history for either category', () => {
    const recent = topup('2026-08-30T08:00:00.000Z', 3) // protected
    const emptyCheckpoint = checkpoint('2026-08-28T08:00:00.000Z', 0) // anchor: nothing left
    const old1 = topup('2026-08-27T08:00:00.000Z', 5)
    const old2 = topup('2026-08-26T08:00:00.000Z', 5)

    const prunable = checkForRelevance([recent, emptyCheckpoint, old1, old2], 'discrete', NOW)

    expect(prunable.map((e) => e.id)).toEqual([old2.id, old1.id])
  })

  it('a single bulk top-up under capacity never anchors by itself', () => {
    const events = [bulkTopup('2026-08-28T08:00:00.000Z', 50), bulkTopup('2026-08-27T08:00:00.000Z', 20)]
    // 50 + 20 = 70, never reaches the tray's 100% capacity
    expect(checkForRelevance(events, 'bulk', NOW)).toEqual([])
  })

  it('a chain of bulk top-ups reaching 100% is treated as proof nothing existed before it', () => {
    const recent = bulkTopup('2026-08-30T08:00:00.000Z', 10) // protected
    const older = bulkTopup('2026-08-20T08:00:00.000Z', 30)
    const monday = bulkTopup('2026-08-26T08:00:00.000Z', 50)
    const tuesday = bulkTopup('2026-08-27T08:00:00.000Z', 50) // chain: 50 + 50 = 100

    const prunable = checkForRelevance([recent, older, monday, tuesday], 'bulk', NOW)

    expect(prunable.map((e) => e.id)).toEqual([older.id])
  })

  it('known tradeoff: a checkpoint resets the chain, but only if the walk reaches it before the chain hits 100%', () => {
    // The checkpoint here is *older* than the chain that reaches 100%, so
    // the walk finds its anchor at "monday" before ever getting far enough
    // back to see the checkpoint — meaning even a confirmed recount can be
    // discarded if a later, unrelated run of top-ups happens to also sum to
    // 100%. This is accepted as part of the same real-world-assumption
    // tradeoff, not treated as a bug.
    const confirmedOld = bulkTopup('2026-08-10T08:00:00.000Z', 10)
    const recount = checkpoint('2026-08-12T08:00:00.000Z', 10) // confirms the 10% is real
    const monday = bulkTopup('2026-08-26T08:00:00.000Z', 50)
    const tuesday = bulkTopup('2026-08-27T08:00:00.000Z', 50) // chain: 50 + 50 = 100, found first

    const prunable = checkForRelevance([confirmedOld, recount, monday, tuesday], 'bulk', NOW)

    expect(prunable.map((e) => e.id)).toEqual([confirmedOld.id, recount.id])
  })

  it('a checkpoint between the protected window and a chain correctly blocks it from reaching 100%', () => {
    const recent = bulkTopup('2026-08-30T08:00:00.000Z', 5) // protected
    const topupB = bulkTopup('2026-08-27T08:00:00.000Z', 40)
    const topupA = bulkTopup('2026-08-25T08:00:00.000Z', 40) // chain so far: 40 + 40 = 80, not enough
    const recount = checkpoint('2026-08-20T08:00:00.000Z', 80) // confirms 80%, resets the chain
    const evenOlder = bulkTopup('2026-08-10T08:00:00.000Z', 30)

    const prunable = checkForRelevance([recent, topupB, topupA, recount, evenOlder], 'bulk', NOW)

    // 80 never reaches 100, and the checkpoint resets the count before
    // `evenOlder` could be added to it — nothing is prunable.
    expect(prunable).toEqual([])
  })

  it('a zero checkpoint still anchors a bulk product', () => {
    const emptyCheckpoint = checkpoint('2026-08-28T08:00:00.000Z', 0)
    const old = bulkTopup('2026-08-27T08:00:00.000Z', 50)

    const prunable = checkForRelevance([emptyCheckpoint, old], 'bulk', NOW)

    expect(prunable.map((e) => e.id)).toEqual([old.id])
  })

  it('never touches anything when the whole history is within the last 24h', () => {
    const events = [topup('2026-08-30T09:00:00.000Z', 12, 12), topup('2026-08-30T10:00:00.000Z', 3)]

    expect(checkForRelevance(events, 'discrete', NOW)).toEqual([])
  })

  it('an event that would otherwise anchor is never used as one while still inside the protected window', () => {
    // Every one of these would individually qualify as a self-defining
    // anchor (a zero checkpoint, an exact recount) if it were older than
    // 24h — but all three are within the window, so the walk skips past
    // each of them without ever treating them as relevant, and nothing
    // gets deleted even though something "irrelevant-looking" is right
    // there in the log.
    const oldestButStillProtected = checkpoint('2026-08-29T13:00:00.000Z', 0) // 23h old
    const middleAnchorCandidate = topup('2026-08-29T15:00:00.000Z', 12, 12) // 21h old
    const newestTopup = topup('2026-08-29T20:00:00.000Z', 5) // 16h old

    const prunable = checkForRelevance(
      [oldestButStillProtected, middleAnchorCandidate, newestTopup],
      'discrete',
      NOW,
    )

    expect(prunable).toEqual([])
  })

  it('does not delete the true first event even if it never qualifies as self-defining', () => {
    // The oldest event has nothing before it regardless of its own payload,
    // but since there's nothing older than it either, the result is still
    // an empty prune list rather than deleting the genesis event itself.
    const onlyEvent = topup('2026-08-20T08:00:00.000Z', 5, 9) // surplus recount, not self-defining
    expect(checkForRelevance([onlyEvent], 'discrete', NOW)).toEqual([])
  })

  it('a non-zero checkpoint does not anchor by itself, since surviving batches still depend on prior dates', () => {
    const recent = topup('2026-08-30T08:00:00.000Z', 3) // protected
    const partialCheckpoint = checkpoint('2026-08-28T08:00:00.000Z', 6) // 6 left, composition unknown without history
    const old = topup('2026-08-27T08:00:00.000Z', 10, 10) // this one IS self-defining

    const prunable = checkForRelevance([recent, partialCheckpoint, old], 'discrete', NOW)

    // Nothing before `old` to prune anyway, but `partialCheckpoint` itself
    // must be kept — it's not a valid anchor on its own.
    expect(prunable).toEqual([])
  })
})
