import { useState } from 'react'
import type { Product } from '../../domain/types'
import { BigButton } from '../shared/BigButton'

interface Props {
  product: Product
  onSubmit: (statedTotal: number) => Promise<void>
}

export function CheckpointForm({ product, onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) {
    return (
      <BigButton variant="primary" onClick={() => setOpen(true)}>
        Update count
      </BigButton>
    )
  }

  async function handleSubmit() {
    if (value === '') return
    setSubmitting(true)
    try {
      await onSubmit(Number(value))
      setValue('')
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sheet">
      <div className="field">
        <label>{product.category === 'bulk' ? 'Current percentage in counter' : 'Current amount left'}</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
      </div>
      <div className="actions-row">
        <BigButton onClick={() => setOpen(false)}>Cancel</BigButton>
        <BigButton variant="primary" disabled={submitting || value === ''} onClick={handleSubmit}>
          Save recount
        </BigButton>
      </div>
    </div>
  )
}
