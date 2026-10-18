import { useCallback, useEffect, useState } from 'react'
import type { Product, CompositionEntry, DomainEvent } from '../domain/types'
import { UNKNOWN_DATE } from '../domain/types'
import { activeComposition, replayEvents, totalActiveQty } from '../domain/batchEngine'
import { batchExpiry, type BatchExpiry } from '../domain/dashboard'
import { daysBetween, toISODate } from '../domain/dates'
import { getEventsForProduct } from '../data/eventsRepo'

export interface CompositionRow extends CompositionEntry {
  /** The day this batch was topped up. Carried separately from `expiry`,
   * which is null for products with no limit configured — those rows still
   * lead with when the stock was put out. */
  openedOn: string | null
  /** When this batch actually goes bad and which limit decides it, so the
   * control page can show a good-till date alongside the shorter counter
   * deadline that may already have overtaken it. */
  expiry: BatchExpiry | null
  daysRemaining: number | null
}

export interface ProductComposition {
  events: DomainEvent[]
  composition: CompositionRow[]
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

  const result = product
    ? replayEvents(events, product.category)
    : { batches: {}, openedOn: {}, unexplainedShortfall: 0 }
  const today = toISODate(new Date())

  const composition = activeComposition(result)
    .filter((e) => e.date !== UNKNOWN_DATE)
    .map((e) => {
      const openedOn = result.openedOn[e.date] ?? null
      const expiry = product ? batchExpiry(e.date, result.openedOn[e.date], product) : null
      return { ...e, openedOn, expiry, daysRemaining: expiry == null ? null : daysBetween(today, expiry.date) }
    })
    // Oldest top-up first: the control page reads as a worklist, and the
    // stock that has been sitting out longest is what gets dealt with first.
    .sort((a, b) => (a.openedOn ?? a.date).localeCompare(b.openedOn ?? b.date) || a.date.localeCompare(b.date))

  return {
    events,
    composition,
    total: totalActiveQty(result),
    unattributed: result.batches[UNKNOWN_DATE] ?? 0,
    unexplainedShortfall: result.unexplainedShortfall,
    loading,
    reload,
  }
}
