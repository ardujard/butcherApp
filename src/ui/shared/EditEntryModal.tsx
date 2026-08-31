import { useState } from 'react'
import type { CheckpointPayload, DomainEvent, Product, TopupPayload } from '../../domain/types'
import { editEvent } from '../../data/eventsRepo'
import { ProductionDateChips } from '../write/ProductionDateChips'
import { BigButton } from './BigButton'
import { RowTotalInput } from './RowTotalInput'

const PERCENT_OPTIONS = [0, 25, 50, 75, 100]

interface Props {
  product: Product
  event: DomainEvent
  onClose: () => void
  onSaved: () => void
}

export function EditEntryModal({ product, event, onClose, onSaved }: Props) {
  const isTopup = event.type === 'topup'
  const topupPayload = event.payload as TopupPayload
  const checkpointPayload = event.payload as CheckpointPayload

  const [productionDate, setProductionDate] = useState(isTopup ? topupPayload.productionDate : '')
  const [addedQty, setAddedQty] = useState(
    isTopup && product.category === 'discrete' ? String(topupPayload.addedQty ?? '') : '',
  )
  const [addedPct, setAddedPct] = useState<number | null>(
    isTopup && product.category === 'bulk' ? (topupPayload.addedPct ?? null) : null,
  )
  const [statedTotal, setStatedTotal] = useState(
    isTopup ? String(topupPayload.statedTotal ?? '') : String(checkpointPayload.statedTotal),
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      if (isTopup) {
        const payload: TopupPayload = {
          productionDate,
          addedQty: product.category === 'discrete' ? Number(addedQty) : undefined,
          addedPct: product.category === 'bulk' ? (addedPct ?? undefined) : undefined,
          statedTotal: product.category === 'discrete' && statedTotal !== '' ? Number(statedTotal) : undefined,
        }
        await editEvent(event.id, payload)
      } else {
        await editEvent(event.id, { statedTotal: Number(statedTotal) })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Edit entry</h3>
        {isTopup && (
          <>
            <ProductionDateChips
              value={productionDate}
              onChange={setProductionDate}
              mode={product.sourceType === 'external' ? 'goodTill' : 'production'}
            />
            {product.category === 'discrete' ? (
              <div className="field-row">
                <div className="field">
                  <label>Added amount</label>
                  {product.rowSize != null && (
                    <span className="row-align-spacer" aria-hidden="true">
                      &nbsp;
                    </span>
                  )}
                  <input type="number" value={addedQty} onChange={(e) => setAddedQty(e.target.value)} />
                </div>
                {product.rowSize != null ? (
                  <RowTotalInput
                    label="Total amount"
                    rowSize={product.rowSize}
                    value={statedTotal === '' ? null : Number(statedTotal)}
                    onChange={(total) => setStatedTotal(total == null ? '' : String(total))}
                  />
                ) : (
                  <div className="field">
                    <label>Total amount</label>
                    <input type="number" value={statedTotal} onChange={(e) => setStatedTotal(e.target.value)} />
                  </div>
                )}
              </div>
            ) : (
              <div className="pct-grid">
                {PERCENT_OPTIONS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    className={addedPct === pct ? 'selected' : ''}
                    onClick={() => setAddedPct(pct)}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {!isTopup && (
          <div className="field">
            <label>Recounted total{product.category === 'bulk' ? ' (%)' : ''}</label>
            <input type="number" value={statedTotal} onChange={(e) => setStatedTotal(e.target.value)} />
          </div>
        )}
        <div className="actions-row">
          <BigButton onClick={onClose}>Cancel</BigButton>
          <BigButton variant="primary" disabled={saving} onClick={handleSave}>
            Save
          </BigButton>
        </div>
      </div>
    </div>
  )
}
