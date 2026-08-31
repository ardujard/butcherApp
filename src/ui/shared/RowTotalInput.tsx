import { useState } from 'react'
import { rowBreakdown, totalFromRows } from '../../domain/reconcile'

interface Props {
  rowSize: number
  value: number | null
  onChange: (total: number | null) => void
  label?: string
}

/** Total-amount entry built from a standard row size ("2 rows + 3") instead
 * of a raw count, with a tucked-away escape hatch back to typing the number
 * directly — for products where counting one by one is awkward (skewers,
 * sausages). Fully controlled: decomposes whatever `value` it's given into
 * rows/extra, so it works the same for a fresh top-up as for editing an
 * existing entry. */
export function RowTotalInput({ rowSize, value, onChange, label = 'Total amount now in counter' }: Props) {
  const [manual, setManual] = useState(false)

  if (manual) {
    return (
      <div className="field">
        <label>{label}</label>
        <span className="row-align-spacer" aria-hidden="true">
          &nbsp;
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
        <button type="button" className="link-button" onClick={() => setManual(false)}>
          ⇄ use rows instead
        </button>
      </div>
    )
  }

  const { rows, extra } = rowBreakdown(value ?? 0, rowSize)

  return (
    <div className="field">
      <label>{label}</label>
      <div className="row-stepper-grid">
        <span className="row-stepper-label">Full rows ({rowSize}/row)</span>
        <span className="row-stepper-label">Loose extra</span>
        <div className="row-stepper-controls">
          <button
            type="button"
            className="icon-button"
            onClick={() => onChange(totalFromRows(Math.max(0, rows - 1), extra, rowSize))}
            aria-label="Fewer rows"
          >
            −
          </button>
          <span className="row-stepper-value">{rows}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => onChange(totalFromRows(rows + 1, extra, rowSize))}
            aria-label="More rows"
          >
            +
          </button>
        </div>
        <div className="row-stepper-controls">
          <button
            type="button"
            className="icon-button"
            onClick={() => onChange(totalFromRows(rows, Math.max(0, extra - 1), rowSize))}
            aria-label="Fewer extra"
          >
            −
          </button>
          <span className="row-stepper-value">{extra}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => onChange(totalFromRows(rows, extra + 1, rowSize))}
            aria-label="More extra"
          >
            +
          </button>
        </div>
      </div>
      <p className="row-stepper-total">= {totalFromRows(rows, extra, rowSize)}</p>
      <button type="button" className="link-button" onClick={() => setManual(true)}>
        ⇄ enter number directly
      </button>
    </div>
  )
}
