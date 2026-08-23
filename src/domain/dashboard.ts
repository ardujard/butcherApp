export interface OldestItemEntry {
  productId: string
  productName: string
  oldestDate: string | null
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
