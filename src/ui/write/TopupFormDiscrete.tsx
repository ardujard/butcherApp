import { useState } from 'react'
import type { Product, TopupPayload } from '../../domain/types'
import { toISODate } from '../../domain/dates'
import { BigButton } from '../shared/BigButton'
import { ProductionDateChips } from './ProductionDateChips'

interface Props {
  product: Product
  onSubmit: (payload: TopupPayload) => Promise<void>
}

export function TopupFormDiscrete({ product, onSubmit }: Props) {
  const [productionDate, setProductionDate] = useState(() => toISODate(new Date()))
  const [addedQty, setAddedQty] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = productionDate !== '' && addedQty !== '' && totalAmount !== '' && !submitting

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await onSubmit({ productionDate, addedQty: Number(addedQty), statedTotal: Number(totalAmount) })
      setAddedQty('')
      setTotalAmount('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sheet">
      <h3>{product.name}</h3>
      <div className="field-row">
        <div className="field">
          <label>Added amount</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={addedQty}
            onChange={(e) => setAddedQty(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Total amount now in counter</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
        </div>
      </div>
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
