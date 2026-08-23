import { useCallback, useEffect, useState } from 'react'
import type { Category, Label, Product } from '../../domain/types'
import { archiveProduct, createProduct, listProducts, renameProduct, restoreProduct } from '../../data/productsRepo'
import { listLabels } from '../../data/labelsRepo'
import { BigButton } from '../shared/BigButton'

export function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [showArchived, setShowArchived] = useState(false)

  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('discrete')
  const [labelId, setLabelId] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLabelId, setEditLabelId] = useState('')

  const reload = useCallback(async () => {
    const [prods, labs] = await Promise.all([listProducts(true), listLabels()])
    setProducts(prods)
    setLabels(labs)
  }, [])
  useEffect(() => {
    reload()
  }, [reload])

  async function handleAdd() {
    if (!name.trim()) return
    await createProduct(name.trim(), category, labelId || null)
    setName('')
    reload()
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    await renameProduct(id, editName.trim(), editLabelId || null)
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
  const visible = products.filter((p) => showArchived || !p.archived)

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
              <option value="discrete">Discrete (units)</option>
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
        <div className="actions-row">
          <BigButton variant="primary" onClick={handleAdd} disabled={!name.trim()}>
            Add product
          </BigButton>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
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
              </div>
            ) : (
              <span>
                {p.name} — {p.category === 'discrete' ? 'Units' : 'Percentage'} · {labelName(p.labelId)}
                {p.archived ? ' (archived)' : ''}
              </span>
            )}
            <span className="row-actions">
              {p.archived ? (
                <BigButton onClick={() => handleRestore(p.id)}>Restore</BigButton>
              ) : editingId === p.id ? (
                <BigButton onClick={() => handleSaveEdit(p.id)}>Save</BigButton>
              ) : (
                <>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditingId(p.id)
                      setEditName(p.name)
                      setEditLabelId(p.labelId ?? '')
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
