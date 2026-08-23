import { useMemo, useState } from 'react'
import type { Label } from '../../domain/types'
import type { ProductWithMeta } from '../../state/useProductList'
import { Chip } from './Chip'

type SortMode = 'popularity' | 'alphabetical'

interface Props {
  products: ProductWithMeta[]
  labels: Label[]
  onSelect: (product: ProductWithMeta) => void
}

export function ProductPicker({ products, labels, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('popularity')

  const filtered = useMemo(() => {
    let list = products
    if (labelFilter) list = list.filter((p) => p.labelId === labelFilter)
    const query = search.trim().toLowerCase()
    if (query) list = list.filter((p) => p.name.toLowerCase().includes(query))

    return list.slice().sort((a, b) => {
      if (sortMode === 'alphabetical') return a.name.localeCompare(b.name)
      return b.popularity - a.popularity || a.name.localeCompare(b.name)
    })
  }, [products, search, labelFilter, sortMode])

  return (
    <div>
      <div className="picker-controls">
        <input
          className="search-input"
          placeholder="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="sort-toggle">
          <button className={sortMode === 'popularity' ? 'active' : ''} onClick={() => setSortMode('popularity')}>
            Popular
          </button>
          <button className={sortMode === 'alphabetical' ? 'active' : ''} onClick={() => setSortMode('alphabetical')}>
            A-Z
          </button>
        </div>
      </div>

      <div className="chip-row" style={{ marginBottom: 16 }}>
        <Chip label="All" selected={labelFilter === null} onClick={() => setLabelFilter(null)} />
        {labels.map((l) => (
          <Chip key={l.id} label={l.name} selected={labelFilter === l.id} onClick={() => setLabelFilter(l.id)} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">No products match.</div>
      ) : (
        <div className="product-list">
          {filtered.map((p) => (
            <button key={p.id} className="product-card" onClick={() => onSelect(p)}>
              <span className="name">{p.name}</span>
              <span className="meta">
                {p.labelName ?? 'No label'} · {p.category === 'discrete' ? 'Units' : 'Percentage'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
