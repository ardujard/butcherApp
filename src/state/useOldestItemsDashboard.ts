import { useCallback, useEffect, useState } from 'react'
import { oldestActiveDate, replayEvents } from '../domain/batchEngine'
import { addDays, daysBetween, toISODate } from '../domain/dates'
import { sortByLifespanRemaining, sortOldestFirst, type OldestItemEntry } from '../domain/dashboard'
import { getEventsForProduct } from '../data/eventsRepo'
import { listProducts } from '../data/productsRepo'

export type DashboardSortMode = 'oldest-date' | 'lifespan'

export function useOldestItemsDashboard() {
  const [entries, setEntries] = useState<OldestItemEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<DashboardSortMode>('oldest-date')

  const reload = useCallback(async () => {
    setLoading(true)
    const products = await listProducts()
    const today = toISODate(new Date())

    const results = await Promise.all(
      products.map(async (p) => {
        const events = await getEventsForProduct(p.id)
        const replay = replayEvents(events, p.category)
        // For in-house products this is the oldest production date still in
        // stock. For external products, the same underlying field holds a
        // good-till date instead, so this becomes the soonest one still in
        // stock — oldestActiveDate always returns the earliest date, which is
        // the right batch to flag either way.
        const oldestDate = oldestActiveDate(replay)
        const daysRemaining =
          oldestDate == null
            ? null
            : p.sourceType === 'external'
              ? daysBetween(today, oldestDate)
              : p.lifespanDays != null
                ? p.lifespanDays - daysBetween(oldestDate, today)
                : null
        // The date daysRemaining counts down to — reconstructed from today +
        // daysRemaining rather than recomputed, so it can't drift out of sync
        // with the number: for in-house that's oldestDate + lifespanDays, for
        // external it's just their good-till date again.
        const expiryDate = daysRemaining == null ? null : addDays(today, daysRemaining)
        return {
          productId: p.id,
          productName: p.name,
          sourceType: p.sourceType,
          oldestDate,
          lifespanDays: p.lifespanDays,
          daysRemaining,
          expiryDate,
        }
      }),
    )
    setEntries(results)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // "Oldest production date" is meaningless for external products (they have
  // no production date), so that mode keeps excluding them; "closest to
  // expiring" covers both in-house lifespan and external good-till dates.
  const sorted =
    sortMode === 'oldest-date'
      ? sortOldestFirst(entries.filter((e) => e.sourceType !== 'external'))
      : sortByLifespanRemaining(entries)

  return { entries: sorted, loading, reload, sortMode, setSortMode }
}
