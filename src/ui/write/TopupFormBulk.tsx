import { useState } from 'react'
import type { Product, TopupPayload } from '../../domain/types'
import { toISODate } from '../../domain/dates'
import { wouldExceedFull } from '../../domain/reconcile'
import { BigButton } from '../shared/BigButton'
import { ProductionDateChips } from './ProductionDateChips'

const PERCENT_OPTIONS = [25, 50, 75, 100]
const SLIDER_STEP = 5

interface Props {
  product: Product
  currentTotal: number
  onSubmit: (payload: TopupPayload) => Promise<void>
}

export function TopupFormBulk({ product, currentTotal, onSubmit }: Props) {
  const [productionDate, setProductionDate] = useState(() => toISODate(new Date()))
  const [addedPct, setAddedPct] = useState<number | null>(null)
  const [showSlider, setShowSlider] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const overflow = addedPct != null && wouldExceedFull(currentTotal, addedPct)
  const canSubmit = productionDate !== '' && addedPct != null && !submitting

  async function handleSubmit() {
    if (addedPct == null) return
    setSubmitting(true)
    try {
      await onSubmit({ productionDate, addedPct })
      setAddedPct(null)
      setShowSlider(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sheet">
      <h3>{product.name}</h3>
      <div className="field">
        <label>Added percentage</label>
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
        <button type="button" className="link-button" onClick={() => setShowSlider(!showSlider)}>
          ⇄ {showSlider ? 'hide fine-tune slider' : 'fine-tune percentage'}
        </button>
        {showSlider && (
          <div className="pct-slider-row">
            <input
              type="range"
              min={SLIDER_STEP}
              max={100}
              step={SLIDER_STEP}
              value={addedPct ?? 50}
              onChange={(e) => setAddedPct(Number(e.target.value))}
            />
            <span className="pct-slider-value">{addedPct ?? 50}%</span>
          </div>
        )}
      </div>
      {overflow && (
        <div className="warning-banner">
          This would push the counter past 100% full — consider doing a recount in Controleer mode instead.
        </div>
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
