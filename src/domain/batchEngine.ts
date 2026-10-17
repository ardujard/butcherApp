import type { Category, CheckpointPayload, CompositionEntry, DomainEvent, ReplayResult, TopupPayload } from './types'
import { UNKNOWN_DATE } from './types'

function sum(batches: Record<string, number>): number {
  return Object.values(batches).reduce((a, b) => a + b, 0)
}

function compareDatesNewestFirst(a: string, b: string): number {
  if (a === UNKNOWN_DATE && b === UNKNOWN_DATE) return 0
  if (a === UNKNOWN_DATE) return 1
  if (b === UNKNOWN_DATE) return -1
  return a < b ? 1 : a > b ? -1 : 0
}

/**
 * Consumes `amount` from `batches` in place, oldest production date first
 * (FIFO). The unknown/unattributed bucket sorts as the oldest of all - it's
 * unexplained legacy stock, not stock to protect from depletion - so it's
 * the first thing a shortfall eats into, same as any other oldest batch. A
 * recount shortfall is attributed to the stock staff are expected to sell
 * down first, not to whatever was just added. A batch that's already at or
 * below zero (e.g. from a negative correction entry) has nothing real to
 * give, so it's skipped rather than treated as removable supply - taking
 * from a negative bucket would reduce `remaining` by less than requested,
 * or even grow it. Returns whatever portion of `amount` couldn't be
 * absorbed because there wasn't enough stock to find it in.
 */
function depleteFifo(batches: Record<string, number>, amount: number): number {
  let remaining = amount
  const dates = Object.keys(batches).sort((a, b) => -compareDatesNewestFirst(a, b))

  for (const date of dates) {
    if (remaining <= 0) break
    const take = Math.min(Math.max(batches[date], 0), remaining)
    batches[date] -= take
    remaining -= take
  }

  return remaining
}

/** Records when a batch first went out onto the counter, keeping the earliest
 * day if several top-ups land on the same batch key. */
function recordOpened(openedOn: Record<string, string>, key: string, recordedAt: string): void {
  const day = recordedAt.slice(0, 10)
  if (openedOn[key] == null || day < openedOn[key]) openedOn[key] = day
}

/**
 * Replays a product's full event history into its current production-date
 * composition. Batches are keyed by production date (not entry order), so a
 * backdated top-up of forgotten old stock is correctly treated as old, even
 * though it was just entered. A fully depleted batch simply reaches qty 0
 * and disappears once filtered for display.
 */
export function replayEvents(events: DomainEvent[], category: Category): ReplayResult {
  const active = events
    .slice()
    .sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : a.id - b.id))

  const batches: Record<string, number> = {}
  const openedOn: Record<string, string> = {}
  let unexplainedShortfall = 0

  for (const event of active) {
    if (event.type === 'topup') {
      const payload = event.payload as TopupPayload

      if (category === 'bulk') {
        // A bulk top-up isn't a delta on top of what's there - the container
        // is always full (100%) after one. addedPct is the new batch's share
        // of that full container, so whatever was already in it (regardless
        // of what it summed to) gets diluted down to the remaining share.
        const addedPct = payload.addedPct ?? 0
        const preSum = sum(batches)
        if (preSum > 0) {
          const remainingShare = Math.max(0, 100 - addedPct) / preSum
          for (const date of Object.keys(batches)) {
            batches[date] *= remainingShare
          }
        }
        batches[payload.productionDate] = (batches[payload.productionDate] ?? 0) + addedPct
        recordOpened(openedOn, payload.productionDate, event.recordedAt)
        continue
      }

      const addAmt = payload.addedQty ?? 0
      const statedTotal = payload.statedTotal

      if (statedTotal != null) {
        // Reconcile against pre-existing stock only: the batch being added
        // right now in this same transaction can't itself be the source of
        // consumption that already happened before it arrived.
        const preSum = sum(batches)
        const diff = statedTotal - (preSum + addAmt)
        if (diff < 0) {
          unexplainedShortfall += depleteFifo(batches, -diff)
        } else if (diff > 0) {
          batches[UNKNOWN_DATE] = (batches[UNKNOWN_DATE] ?? 0) + diff
        }
      }

      batches[payload.productionDate] = (batches[payload.productionDate] ?? 0) + addAmt
      recordOpened(openedOn, payload.productionDate, event.recordedAt)
    } else {
      const payload = event.payload as CheckpointPayload
      const diff = payload.statedTotal - sum(batches)
      if (diff < 0) {
        unexplainedShortfall += depleteFifo(batches, -diff)
      } else if (diff > 0) {
        batches[UNKNOWN_DATE] = (batches[UNKNOWN_DATE] ?? 0) + diff
      }
    }
  }

  return { batches, openedOn, unexplainedShortfall }
}

/** Current composition, newest date first, zero-qty batches dropped. */
export function activeComposition(result: ReplayResult): CompositionEntry[] {
  return Object.entries(result.batches)
    .filter(([, qty]) => qty > 0)
    .map(([date, qty]) => ({ date, qty }))
    .sort((a, b) => compareDatesNewestFirst(a.date, b.date))
}

/** Oldest dated (i.e. attributable) batch still in stock, or null if none. */
export function oldestActiveDate(result: ReplayResult): string | null {
  const dated = activeComposition(result).filter((e) => e.date !== UNKNOWN_DATE)
  if (dated.length === 0) return null
  return dated[dated.length - 1].date
}

export function totalActiveQty(result: ReplayResult): number {
  return sum(result.batches)
}
