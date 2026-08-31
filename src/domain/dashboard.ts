export interface OldestItemEntry {
  productId: string
  productName: string
  oldestDate: string | null
  lifespanDays: number | null
  /** lifespanDays minus days elapsed since oldestDate; null if lifespan isn't
   * tracked for this product or it has no dated stock. Can go negative once
   * the lifespan is exceeded. */
  daysRemaining: number | null
}

export type LifespanStatus = 'ok' | 'warning' | 'exceeded'

/** How close to its lifespan limit a batch must be before the control page
 * flags it: 1 day remaining or less is a warning, 0 or fewer is exceeded.
 * Fixed-day cutoff (not a percentage of lifespan), so every product gets the
 * same "heads up, by tomorrow" signal regardless of its own lifespan length. */
export const LIFESPAN_WARNING_DAYS = 1

export function lifespanStatus(daysRemaining: number | null): LifespanStatus | null {
  if (daysRemaining == null) return null
  if (daysRemaining <= 0) return 'exceeded'
  if (daysRemaining <= LIFESPAN_WARNING_DAYS) return 'warning'
  return 'ok'
}

/** Products with the oldest at-risk stock first; products with no dated
 * stock (null) sort last. */
export function sortOldestFirst(entries: OldestItemEntry[]): OldestItemEntry[] {
  return entries.slice().sort((a, b) => {
    if (a.oldestDate == null && b.oldestDate == null) return 0
    if (a.oldestDate == null) return 1
    if (b.oldestDate == null) return -1
    return a.oldestDate < b.oldestDate ? -1 : a.oldestDate > b.oldestDate ? 1 : 0
  })
}

/** Products closest to exceeding their lifespan first; products with no
 * lifespan tracked, or no dated stock, sort last. */
export function sortByLifespanRemaining(entries: OldestItemEntry[]): OldestItemEntry[] {
  return entries.slice().sort((a, b) => {
    if (a.daysRemaining == null && b.daysRemaining == null) return 0
    if (a.daysRemaining == null) return 1
    if (b.daysRemaining == null) return -1
    return a.daysRemaining - b.daysRemaining
  })
}
