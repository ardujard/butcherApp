import type { Category, CheckpointPayload, DomainEvent, TopupPayload } from './types'

const PROTECTED_WINDOW_MS = 24 * 60 * 60 * 1000
const BULK_CAPACITY_PCT = 100

/**
 * True when an event's own payload fully determines the stock state at that
 * moment, independent of anything recorded before it: a discrete top-up
 * whose recount claims no pre-existing stock (statedTotal === addedQty, so
 * the implied prior total was zero), or a checkpoint recounting to zero.
 */
function isSelfDefining(event: DomainEvent, category: Category): boolean {
  if (event.type === 'checkpoint') {
    return (event.payload as CheckpointPayload).statedTotal === 0
  }
  if (category !== 'discrete') return false
  const payload = event.payload as TopupPayload
  if (payload.statedTotal == null) return false
  return payload.statedTotal === (payload.addedQty ?? 0)
}

/**
 * Finds events that are safe to discard from a product's full history.
 * Events recorded in the last 24h are never touched. Walking backward from
 * there:
 *
 *  - the first self-defining event found becomes the retained anchor —
 *    everything strictly older than it contributes nothing a full replay
 *    wouldn't already get from the anchor onward;
 *  - for bulk products, a run of consecutive top-ups (no checkpoint in
 *    between) whose added percentages sum to >=100 is *also* treated as an
 *    anchor: a tray can't physically hold more than its capacity, so a run
 *    that fills it is taken as proof nothing existed before it. This is a
 *    real-world assumption, not a mathematical certainty — see the "known
 *    tradeoff" tests in retention.test.ts for the case where it isn't true.
 *    A checkpoint (of any value) breaks the run and resets this count,
 *    since it's no longer a pure addition once a recount happens.
 *
 * Returns an empty array if no anchor exists yet.
 */
export function checkForRelevance(events: DomainEvent[], category: Category, now: Date = new Date()): DomainEvent[] {
  const cutoff = now.getTime() - PROTECTED_WINDOW_MS
  const sorted = events
    .slice()
    .sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : a.id - b.id))

  let bulkChainSum = 0

  for (let i = sorted.length - 1; i >= 0; i--) {
    const event = sorted[i]
    if (new Date(event.recordedAt).getTime() >= cutoff) continue // within the protected window

    if (isSelfDefining(event, category)) {
      return sorted.slice(0, i)
    }

    if (category === 'bulk') {
      if (event.type === 'topup') {
        bulkChainSum += (event.payload as TopupPayload).addedPct ?? 0
        if (bulkChainSum >= BULK_CAPACITY_PCT) {
          return sorted.slice(0, i)
        }
      } else {
        bulkChainSum = 0 // a checkpoint breaks the pure-addition chain
      }
    }
  }

  return []
}
