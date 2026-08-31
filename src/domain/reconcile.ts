import type { DomainEvent } from './types'

/** Once a product has any history, its category can't change: discrete
 * counts and bulk percentage-points aren't compatible units to replay
 * together. Repurpose by archiving and creating a new product instead. */
export function isCategoryLocked(events: DomainEvent[]): boolean {
  return events.length > 0
}

/** Bulk stock is a 0-100 percentage scale with no recount field to
 * self-correct at write time, so it can silently drift past "full". Warn
 * (non-blocking) rather than reject the entry. */
export function wouldExceedFull(currentActiveSum: number, addedPct: number): boolean {
  return currentActiveSum + addedPct > 100
}

/** Decomposes a total into rows of a fixed size plus a loose remainder, so
 * staff can build up a count like "2 rows + 3" instead of counting stock one
 * by one. */
export function rowBreakdown(total: number, rowSize: number): { rows: number; extra: number } {
  return { rows: Math.floor(total / rowSize), extra: total % rowSize }
}

export function totalFromRows(rows: number, extra: number, rowSize: number): number {
  return rows * rowSize + extra
}

/** Amount added, inferred from how many were left before the top-up and the
 * recounted total after — the alternative to counting freshly-added stock
 * directly, which is awkward for items like skewers or sausages. Can go
 * negative if the entered numbers don't add up, which callers should flag. */
export function addedFromLeftBefore(total: number, leftBefore: number): number {
  return total - leftBefore
}

/** Days since a product's last checkpoint recount, or null if it has never
 * had one. Bulk products drift faster than discrete ones (no self-correcting
 * total field on write), so the UI uses this to nudge staff toward a
 * periodic recount. */
export function daysSinceLastCheckpoint(events: DomainEvent[], from: Date = new Date()): number | null {
  const checkpoints = events.filter((e) => e.type === 'checkpoint')
  if (checkpoints.length === 0) return null

  const last = checkpoints.reduce((latest, e) => (e.recordedAt > latest.recordedAt ? e : latest))
  const diffMs = from.getTime() - new Date(last.recordedAt).getTime()
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}
