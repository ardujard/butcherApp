import { useCallback, useEffect, useState } from 'react'
import type { Category, Label, Product, SourceType } from '../../domain/types'
import {
  archiveProduct,
  createProduct,
  listProducts,
  renameProduct,
  restoreProduct,
  updateProductSettings,
} from '../../data/productsRepo'
import { listLabels } from '../../data/labelsRepo'
import { getEventsForProduct } from '../../data/eventsRepo'
import { isProductTypeLocked } from '../../domain/reconcile'
import { parseOptionalWholeNumber } from '../../domain/validation'
import { BigButton } from '../shared/BigButton'

export function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set())
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')

  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('discrete')
  const [labelId, setLabelId] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('in house')
  const [lifespanDays, setLifespanDays] = useState('')
  const [layerSize, setLayerSize] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLabelId, setEditLabelId] = useState('')
  const [editSourceType, setEditSourceType] = useState<SourceType>('in house')
  const [editLifespanDays, setEditLifespanDays] = useState('')
  const [editLayerSize, setEditLayerSize] = useState('')

  const reload = useCallback(async () => {
    const [prods, labs] = await Promise.all([listProducts(true), listLabels()])
    const locked = await Promise.all(prods.map(async (p) => isProductTypeLocked(await getEventsForProduct(p.id))))
    setLockedIds(new Set(prods.filter((_, i) => locked[i]).map((p) => p.id)))
    setProducts(prods)
    setLabels(labs)
  }, [])
  useEffect(() => {
    reload()
  }, [reload])

  // Lifespan may be 0 (out of the counter the same day); a layer of 0 would
  // divide by zero when splitting a total into layers.
  const newLifespan = parseOptionalWholeNumber(lifespanDays, 0)
  const newLayerSize = category === 'discrete' ? parseOptionalWholeNumber(layerSize, 1) : null
  const newValid = name.trim() !== '' && newLifespan !== undefined && newLayerSize !== undefined
  const editLifespan = parseOptionalWholeNumber(editLifespanDays, 0)
  const editLayer = parseOptionalWholeNumber(editLayerSize, 1)
  const editValid = editName.trim() !== '' && editLifespan !== undefined && editLayer !== undefined

  async function handleAdd() {
    if (!newValid) return
    await createProduct(name.trim(), category, labelId || null, sourceType, newLifespan, newLayerSize)
    setName('')
    setSourceType('in house')
    setLifespanDays('')
    setLayerSize('')
    reload()
  }

  async function handleSaveEdit(id: string) {
    if (!editValid) return
    await renameProduct(id, editName.trim(), editLabelId || null)
    await updateProductSettings(id, editSourceType, editLifespan, editLayer)
    setEditingId(null)
    reload()
  }

  async function handleArchive(id: string) {
    await archiveProduct(id)
    reload()
  }

  async function handleRestore(id: string) {
    await restoreProduct(id)
    reload()
  }

  const labelName = (id: string | null) => labels.find((l) => l.id === id)?.name ?? 'No label'
  const query = search.trim().toLowerCase()
  const visible = products.filter(
    (p) => (showArchived || !p.archived) && (query === '' || p.name.toLowerCase().includes(query)),
  )

  return (
    <div>
      <div className="sheet">
        <h3>New product</h3>
        <div className="field-row">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kaasburger" />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              <option value="discrete">Telbaar</option>
              <option value="bulk">Bulk (percentage)</option>
            </select>
          </div>
          <div className="field">
            <label>Label</label>
            <select value={labelId} onChange={(e) => setLabelId(e.target.value)}>
              <option value="">No label</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Source</label>
            <select
              value={sourceType}
              onChange={(e) => {
                setSourceType(e.target.value as SourceType)
              }}
            >
              <option value="in house">In house</option>
              <option value="external">External</option>
            </select>
          </div>
          <div className="field">
            <label>{sourceType === 'external' ? 'Dagen in toonbank (optioneel)' : 'Lifespan (days, optional)'}</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={lifespanDays}
              onChange={(e) => setLifespanDays(e.target.value)}
              placeholder="e.g. 3"
            />
            <p className="hint-note">
              {sourceType === 'external'
                ? 'Geteld vanaf het bijvullen, naast de houdbaar-tot-datum.'
                : 'Geteld vanaf de productiedatum.'}
            </p>
          </div>
          {category === 'discrete' && (
            <div className="field">
              <label>Laaggrootte (optioneel)</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={layerSize}
                onChange={(e) => setLayerSize(e.target.value)}
                placeholder="e.g. 8"
              />
            </div>
          )}
        </div>
        {(newLifespan === undefined || newLayerSize === undefined) && (
          <div className="warning-banner">
            Gebruik hele getallen: dagen vanaf 0, laaggrootte vanaf 1.
          </div>
        )}
        <div className="actions-row">
          <BigButton variant="primary" onClick={handleAdd} disabled={!newValid}>
            Add product
          </BigButton>
        </div>
      </div>

      <input
        className="search-input"
        style={{ marginTop: 20 }}
        placeholder="Search products"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>

      <div className="admin-list" style={{ marginTop: 12 }}>
        {visible.map((p) => (
          <div key={p.id} className="admin-row">
            {editingId === p.id ? (
              <div className="field-row" style={{ flex: 1 }}>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                <select value={editLabelId} onChange={(e) => setEditLabelId(e.target.value)}>
                  <option value="">No label</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select
                  value={editSourceType}
                  disabled={lockedIds.has(p.id)}
                  onChange={(e) => {
                    setEditSourceType(e.target.value as SourceType)
                  }}
                >
                  <option value="in house">In house</option>
                  <option value="external">External</option>
                </select>
                {lockedIds.has(p.id) && (
                  <p className="hint-note">Bron vast: dit product heeft al geschiedenis.</p>
                )}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={editLifespanDays}
                  onChange={(e) => setEditLifespanDays(e.target.value)}
                  placeholder={editSourceType === 'external' ? 'Dagen in toonbank' : 'Lifespan (days)'}
                />
                {p.category === 'discrete' && (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={editLayerSize}
                    onChange={(e) => setEditLayerSize(e.target.value)}
                    placeholder="Laaggrootte"
                  />
                )}
              </div>
            ) : (
              <span>
                {p.name} — {p.category === 'discrete' ? 'Telbaar' : 'Percentage'} · {labelName(p.labelId)} ·{' '}
                {p.sourceType === 'external' ? 'External' : 'In house'}
                {p.lifespanDays != null
                  ? p.sourceType === 'external'
                    ? ` · Toonbank ${p.lifespanDays}d`
                    : ` · Lifespan ${p.lifespanDays}d`
                  : ''}
                {p.layerSize != null ? ` · Laag van ${p.layerSize}` : ''}
                {p.archived ? ' (archived)' : ''}
              </span>
            )}
            <span className="row-actions">
              {p.archived ? (
                <BigButton onClick={() => handleRestore(p.id)}>Restore</BigButton>
              ) : editingId === p.id ? (
                <BigButton onClick={() => handleSaveEdit(p.id)} disabled={!editValid}>
                  Save
                </BigButton>
              ) : (
                <>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditingId(p.id)
                      setEditName(p.name)
                      setEditLabelId(p.labelId ?? '')
                      setEditSourceType(p.sourceType)
                      setEditLifespanDays(p.lifespanDays != null ? String(p.lifespanDays) : '')
                      setEditLayerSize(p.layerSize != null ? String(p.layerSize) : '')
                    }}
                    aria-label="Edit"
                  >
                    ✏️
                  </button>
                  <button className="icon-button" onClick={() => handleArchive(p.id)} aria-label="Archive">
                    🗑️
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
        {visible.length === 0 && <p className="empty-state">No products yet.</p>}
      </div>
    </div>
  )
}
