import type { SourceType } from './types'

export interface OldestItemEntry {
  productId: string
  productName: string
  sourceType: SourceType
  oldestDate: string | null
  lifespanDays: number | null
  /** For in-house products: lifespanDays minus days elapsed since oldestDate,
   * null if lifespan isn't tracked. For external products: days remaining
   * until their good-till date. Null either way if there's no dated stock.
   * Can go negative once the limit is passed. */
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

/** Products closest to exceeding their lifespan or good-till date first;
 * products with neither tracked, or no dated stock, sort last. */
export function sortByLifespanRemaining(entries: OldestItemEntry[]): OldestItemEntry[] {
  return entries.slice().sort((a, b) => {
    if (a.daysRemaining == null && b.daysRemaining == null) return 0
    if (a.daysRemaining == null) return 1
    if (b.daysRemaining == null) return -1
    return a.daysRemaining - b.daysRemaining
  })
}
