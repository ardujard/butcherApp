import { replayEvents } from './batchEngine'
import type { Category, DomainEvent, ReplayResult } from './types'

// Replay arithmetic on bulk percentages is floating point; dropping an entry
// can change the order of operations without changing the real result.
const EPSILON = 1e-9

function sameQty(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b))
}

/**
 * Whether two replays leave the counter in the same state, as far as anything
 * the app shows or will compute next is concerned: every batch's quantity
 * (a batch missing from one side counts as 0, which replays identically), and
 * the top-up day of every batch still in stock.
 *
 * Not compared: the top-up day of a batch that has run out. It only matters
 * again if a later top-up reuses the same batch date, which then counts from
 * its own day instead of the long-gone batch's — the more accurate answer.
 * Nor unexplainedShortfall, a running tally of past data-quality problems that
 * no screen shows; comparing it would pin every entry that ever produced a
 * shortfall in place forever.
 */
export function sameCounterState(a: ReplayResult, b: ReplayResult): boolean {
  const keys = new Set([...Object.keys(a.batches), ...Object.keys(b.batches)])
  for (const key of keys) {
    const qa = a.batches[key] ?? 0
    const qb = b.batches[key] ?? 0
    if (!sameQty(qa, qb)) return false
    if (qa > 0 && a.openedOn[key] !== b.openedOn[key]) return false
  }
  return true
}

/**
 * The entries recorded before `cutoffISO` that can be deleted without
 * changing the product's current stock.
 *
 * An entry is irrelevant when replaying the history without it leaves the
 * counter in the same state. Because replay runs in recorded order and new
 * entries are always recorded after existing ones, an entry that is
 * irrelevant now stays irrelevant for every entry still to come. The
 * exception is editing or deleting a later entry, which can make an
 * already-deleted one matter again; that is the accepted cost of not keeping
 * history forever.
 *
 * Entries are tested oldest first, each against the history with the ones
 * already chosen removed: two identical recounts in a row are each
 * irrelevant on their own, but not both together.
 */
export function prunableEvents(events: DomainEvent[], category: Category, cutoffISO: string): DomainEvent[] {
  const target = replayEvents(events, category)
  const candidates = events
    .filter((e) => e.recordedAt < cutoffISO)
    .sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : a.id - b.id))

  let kept = events
  const prunable: DomainEvent[] = []
  for (const candidate of candidates) {
    const without = kept.filter((e) => e !== candidate)
    if (sameCounterState(replayEvents(without, category), target)) {
      kept = without
      prunable.push(candidate)
    }
  }
  return prunable
}
