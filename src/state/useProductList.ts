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

async function loadProductList(): Promise<{ products: ProductWithMeta[]; labels: Label[] }> {
  const [prods, labels] = await Promise.all([listProducts(), listLabels()])
  const labelNameById = new Map(labels.map((l) => [l.id, l.name]))
  const sinceISO = new Date(Date.now() - POPULARITY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const products = await Promise.all(
    prods.map(async (p) => ({
      ...p,
      labelName: p.labelId ? (labelNameById.get(p.labelId) ?? null) : null,
      popularity: await countEventsSince(p.id, sinceISO),
    })),
  )
  return { products, labels }
}

export function useProductList() {
  const [products, setProducts] = useState<ProductWithMeta[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)

  // State is only set once the data has arrived; a reload keeps showing the
  // current list rather than flashing back to a loading state.
  const reload = useCallback(
    () =>
      loadProductList().then(({ products, labels }) => {
        setProducts(products)
        setLabels(labels)
        setLoading(false)
      }),
    [],
  )

  useEffect(() => {
    reload()
  }, [reload])

  return { products, labels, loading, reload }
}
