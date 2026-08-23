import { useCallback, useEffect, useState } from 'react'
import type { Label, Product } from '../domain/types'
import { countEventsSince } from '../data/eventsRepo'
import { listLabels } from '../data/labelsRepo'
import { listProducts } from '../data/productsRepo'

const POPULARITY_WINDOW_DAYS = 60

export interface ProductWithMeta extends Product {
  labelName: string | null
  popularity: number
}

export function useProductList() {
  const [products, setProducts] = useState<ProductWithMeta[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const [prods, labs] = await Promise.all([listProducts(), listLabels()])
    const labelNameById = new Map(labs.map((l) => [l.id, l.name]))
    const sinceISO = new Date(Date.now() - POPULARITY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const withMeta = await Promise.all(
      prods.map(async (p) => ({
        ...p,
        labelName: p.labelId ? (labelNameById.get(p.labelId) ?? null) : null,
        popularity: await countEventsSince(p.id, sinceISO),
      })),
    )

    setProducts(withMeta)
    setLabels(labs)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { products, labels, loading, reload }
}
