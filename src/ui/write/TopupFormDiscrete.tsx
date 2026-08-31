import { useState } from 'react'
import type { Product, TopupPayload } from '../../domain/types'
import { toISODate } from '../../domain/dates'
import { addedFromLeftBefore } from '../../domain/reconcile'
import { BigButton } from '../shared/BigButton'
import { LayerTotalInput } from '../shared/LayerTotalInput'
import { ProductionDateChips } from './ProductionDateChips'

type InputMode = 'left-before' | 'added'

interface Props {
  product: Product
  onSubmit: (payload: TopupPayload) => Promise<void>
}

export function TopupFormDiscrete({ product, onSubmit }: Props) {
  const [productionDate, setProductionDate] = useState(() => toISODate(new Date()))
  const [mode, setMode] = useState<InputMode>('left-before')
  const [leftBefore, setLeftBefore] = useState('')
  const [addedQty, setAddedQty] = useState('')
  const [totalAmount, setTotalAmount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const computedAdded =
    mode === 'left-before'
      ? leftBefore !== '' && totalAmount != null
        ? addedFromLeftBefore(totalAmount, Number(leftBefore))
        : null
      : addedQty !== ''
        ? Number(addedQty)
        : null

  const canSubmit =
    productionDate !== '' &&
    totalAmount != null &&
    computedAdded != null &&
    (mode === 'left-before' ? leftBefore !== '' : addedQty !== '') &&
    !submitting

  async function handleSubmit() {
    if (totalAmount == null || computedAdded == null) return
    setSubmitting(true)
    try {
      await onSubmit({ productionDate, addedQty: computedAdded, statedTotal: totalAmount })
      setLeftBefore('')
      setAddedQty('')
      setTotalAmount(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sheet">
      <h3>{product.name}</h3>
      <div className="field-row">
        {mode === 'left-before' ? (
          <div className="field">
            <label>Hoeveelheid voor aanvullen</label>
            {product.layerSize != null && (
              <span className="layer-align-spacer" aria-hidden="true">
                &nbsp;
              </span>
            )}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={leftBefore}
              onChange={(e) => setLeftBefore(e.target.value)}
            />
            <button type="button" className="link-button" onClick={() => setMode('added')}>
              ⇄ enter amount added instead
            </button>
          </div>
        ) : (
          <div className="field">
            <label>Aangevulde hoeveelheid</label>
            {product.layerSize != null && (
              <span className="layer-align-spacer" aria-hidden="true">
                &nbsp;
              </span>
            )}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={addedQty}
              onChange={(e) => setAddedQty(e.target.value)}
            />
            <button type="button" className="link-button" onClick={() => setMode('left-before')}>
              ⇄ enter amount left before instead
            </button>
          </div>
        )}
        {product.layerSize != null ? (
          <LayerTotalInput layerSize={product.layerSize} value={totalAmount} onChange={setTotalAmount} />
        ) : (
          <div className="field">
            <label>Totale hoeveelheid na aanvullen</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={totalAmount ?? ''}
              onChange={(e) => setTotalAmount(e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>
        )}
      </div>
      {computedAdded != null && computedAdded < 0 && (
        <div className="warning-banner">This means fewer items than were left before — check the numbers.</div>
      )}
      <ProductionDateChips
        value={productionDate}
        onChange={setProductionDate}
        mode={product.sourceType === 'external' ? 'goodTill' : 'production'}
      />
      <div className="actions-row">
        <BigButton variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
          Log top-up
        </BigButton>
      </div>
    </div>
  )
}
