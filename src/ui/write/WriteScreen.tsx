import { useState } from 'react'
import type { TopupPayload } from '../../domain/types'
import { addTopup } from '../../data/eventsRepo'
import { useProductComposition } from '../../state/useProductComposition'
import { useProductList, type ProductWithMeta } from '../../state/useProductList'
import { RecentEntriesList } from '../shared/RecentEntriesList'
import { ProductPicker } from '../shared/ProductPicker'
import { TopupFormBulk } from './TopupFormBulk'
import { TopupFormDiscrete } from './TopupFormDiscrete'

const RECENT_ENTRIES_LIMIT = 5

export function WriteScreen() {
  const { products, labels, reload: reloadProducts } = useProductList()
  const [selected, setSelected] = useState<ProductWithMeta | null>(null)
  const composition = useProductComposition(selected ?? undefined)

  if (!selected) {
    return <ProductPicker products={products} labels={labels} onSelect={setSelected} />
  }

  async function handleSubmit(payload: TopupPayload) {
    await addTopup(selected!.id, payload)
    await Promise.all([composition.reload(), reloadProducts()])
  }

  function handleChanged() {
    composition.reload()
    reloadProducts()
  }

  const recentEntries = composition.events
    .filter((e) => !e.deleted)
    .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : a.recordedAt > b.recordedAt ? -1 : b.id - a.id))
    .slice(0, RECENT_ENTRIES_LIMIT)

  return (
    <div>
      <button className="back-button" onClick={() => setSelected(null)} aria-label="Back to product list">
        ←
      </button>
      {selected.category === 'discrete' ? (
        <TopupFormDiscrete product={selected} onSubmit={handleSubmit} />
      ) : (
        <TopupFormBulk product={selected} currentTotal={composition.total} onSubmit={handleSubmit} />
      )}
      <div style={{ marginTop: 20 }}>
        <RecentEntriesList product={selected} events={recentEntries} onChanged={handleChanged} />
      </div>
    </div>
  )
}
