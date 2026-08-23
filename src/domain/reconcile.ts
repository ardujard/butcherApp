import type { DomainEvent } from './types'

/** Once a product has any history, its category can't change: discrete
 * counts and bulk percentage-points aren't compatible units to replay
 * together. Repurpose by archiving and creating a new product instead. */
export function isCategoryLocked(events: DomainEvent[]): boolean {
  return events.some((e) => !e.deleted)
}

/** Bulk stock is a 0-100 percentage scale with no recount field to
 * self-correct at write time, so it can silently drift past "full". Warn
 * (non-blocking) rather than reject the entry. */
export function wouldExceedFull(currentActiveSum: number, addedPct: number): boolean {
  return currentActiveSum + addedPct > 100
}

/** Days since a product's last checkpoint recount, or null if it has never
 * had one. Bulk products drift faster than discrete ones (no self-correcting
 * total field on write), so the UI uses this to nudge staff toward a
 * periodic recount. */
export function daysSinceLastCheckpoint(events: DomainEvent[], from: Date = new Date()): number | null {
  const checkpoints = events.filter((e) => !e.deleted && e.type === 'checkpoint')
  if (checkpoints.length === 0) return null

  const last = checkpoints.reduce((latest, e) => (e.recordedAt > latest.recordedAt ? e : latest))
  const diffMs = from.getTime() - new Date(last.recordedAt).getTime()
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}
