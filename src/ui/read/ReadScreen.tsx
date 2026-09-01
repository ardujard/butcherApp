import { useState } from 'react'
import { addCheckpoint } from '../../data/eventsRepo'
import { useProductComposition } from '../../state/useProductComposition'
import { useProductList, type ProductWithMeta } from '../../state/useProductList'
import { RecentEntriesList } from '../shared/RecentEntriesList'
import { ProductPicker } from '../shared/ProductPicker'
import { BigButton } from '../shared/BigButton'
import { CheckpointForm } from './CheckpointForm'
import { CompositionView } from './CompositionView'
import { OldestItemsDashboard } from './OldestItemsDashboard'

const RECENT_ENTRIES_LIMIT = 5

export function ReadScreen() {
  const { products, labels, reload: reloadProducts } = useProductList()
  const [selected, setSelected] = useState<ProductWithMeta | null>(null)
  const [showOldest, setShowOldest] = useState(false)
  const composition = useProductComposition(selected ?? undefined)

  if (showOldest) {
    return (
      <OldestItemsDashboard
        onBack={() => setShowOldest(false)}
        onSelectProduct={(productId) => {
          const product = products.find((p) => p.id === productId)
          if (!product) return
          setSelected(product)
          setShowOldest(false)
        }}
      />
    )
  }

  if (!selected) {
    return (
      <div>
        <div className="actions-row" style={{ justifyContent: 'flex-start', marginBottom: 16 }}>
          <BigButton onClick={() => setShowOldest(true)}>Oldest stock ⚠️</BigButton>
        </div>
        <ProductPicker products={products} labels={labels} onSelect={setSelected} />
      </div>
    )
  }

  async function handleCheckpoint(statedTotal: number) {
    await addCheckpoint(selected!.id, { statedTotal })
    await Promise.all([composition.reload(), reloadProducts()])
  }

  function handleChanged() {
    composition.reload()
    reloadProducts()
  }

  const recentEntries = composition.events
    .slice()
    .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : a.recordedAt > b.recordedAt ? -1 : b.id - a.id))
    .slice(0, RECENT_ENTRIES_LIMIT)

  return (
    <div>
      <button
        className="back-button"
        style={{ marginBottom: 16 }}
        onClick={() => setSelected(null)}
        aria-label="Back to product list"
      >
        ←
      </button>
      <CompositionView
        product={selected}
        composition={composition.composition}
        oldestDate={composition.oldestDate}
        total={composition.total}
        unattributed={composition.unattributed}
      />
      <div style={{ marginTop: 16 }}>
        <CheckpointForm product={selected} onSubmit={handleCheckpoint} />
      </div>
      <div style={{ marginTop: 20 }}>
        <RecentEntriesList product={selected} events={recentEntries} onChanged={handleChanged} />
      </div>
    </div>
  )
}
