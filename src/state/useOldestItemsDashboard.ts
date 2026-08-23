import { useCallback, useEffect, useState } from 'react'
import { oldestActiveDate, replayEvents } from '../domain/batchEngine'
import { sortOldestFirst, type OldestItemEntry } from '../domain/dashboard'
import { getEventsForProduct } from '../data/eventsRepo'
import { listProducts } from '../data/productsRepo'

export function useOldestItemsDashboard() {
  const [entries, setEntries] = useState<OldestItemEntry[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const products = await listProducts()
    const results = await Promise.all(
      products.map(async (p) => {
        const events = await getEventsForProduct(p.id)
        const replay = replayEvents(events, p.category)
        return { productId: p.id, productName: p.name, oldestDate: oldestActiveDate(replay) }
      }),
    )
    setEntries(sortOldestFirst(results))
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { entries, loading, reload }
}
