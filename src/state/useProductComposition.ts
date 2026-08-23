import { useCallback, useEffect, useState } from 'react'
import type { Product, CompositionEntry, DomainEvent } from '../domain/types'
import { UNKNOWN_DATE } from '../domain/types'
import { activeComposition, oldestActiveDate, replayEvents, totalActiveQty } from '../domain/batchEngine'
import { getEventsForProduct } from '../data/eventsRepo'

export interface ProductComposition {
  events: DomainEvent[]
  composition: CompositionEntry[]
  oldestDate: string | null
  total: number
  unattributed: number
  unexplainedShortfall: number
  loading: boolean
  reload: () => Promise<void>
}

/** Loads a product's full event history and replays it fresh. Recomputed on
 * every mount/selection change rather than cached, so a stale view can never
 * linger through the PWA being backgrounded and reopened. */
export function useProductComposition(product: Product | undefined): ProductComposition {
  const [events, setEvents] = useState<DomainEvent[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!product) {
      setEvents([])
      setLoading(false)
      return
    }
    setLoading(true)
    setEvents(await getEventsForProduct(product.id))
    setLoading(false)
  }, [product])

  useEffect(() => {
    reload()
  }, [reload])

  const result = product ? replayEvents(events, product.category) : { batches: {}, unexplainedShortfall: 0 }

  return {
    events,
    composition: activeComposition(result).filter((e) => e.date !== UNKNOWN_DATE),
    oldestDate: oldestActiveDate(result),
    total: totalActiveQty(result),
    unattributed: result.batches[UNKNOWN_DATE] ?? 0,
    unexplainedShortfall: result.unexplainedShortfall,
    loading,
    reload,
  }
}
