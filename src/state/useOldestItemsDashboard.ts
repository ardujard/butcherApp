import { useCallback, useEffect, useState } from 'react'
import { oldestActiveDate, replayEvents } from '../domain/batchEngine'
import { daysBetween, toISODate } from '../domain/dates'
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
    // External products have no production date to sort by — they're
    // tracked by good-till date instead, so they're excluded from this
    // dashboard entirely rather than shown with a misleading empty date.
    const products = (await listProducts()).filter((p) => p.sourceType !== 'external')
    const today = toISODate(new Date())

    const results = await Promise.all(
      products.map(async (p) => {
        const events = await getEventsForProduct(p.id)
        const replay = replayEvents(events, p.category)
        const oldestDate = oldestActiveDate(replay)
        const daysRemaining =
          p.lifespanDays != null && oldestDate != null ? p.lifespanDays - daysBetween(oldestDate, today) : null
        return { productId: p.id, productName: p.name, oldestDate, lifespanDays: p.lifespanDays, daysRemaining }
      }),
    )
    setEntries(results)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const sorted = sortMode === 'oldest-date' ? sortOldestFirst(entries) : sortByLifespanRemaining(entries)

  return { entries: sorted, loading, reload, sortMode, setSortMode }
}
