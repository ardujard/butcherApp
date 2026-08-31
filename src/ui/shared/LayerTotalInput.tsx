import { useState } from 'react'
import { layerBreakdown, totalFromLayers } from '../../domain/reconcile'

interface Props {
  layerSize: number
  value: number | null
  onChange: (total: number | null) => void
  label?: string
}

/** Total-amount entry built from a standard layer size ("2 layers + 3")
 * instead of a raw count, with a tucked-away escape hatch back to typing the
 * number directly — for products where counting one by one is awkward
 * (skewers, sausages). Fully controlled: decomposes whatever `value` it's
 * given into layers/extra, so it works the same for a fresh top-up as for
 * editing an existing entry. */
export function LayerTotalInput({ layerSize, value, onChange, label = 'Totaal hoeveelheid na aanvullen' }: Props) {
  const [manual, setManual] = useState(false)

  if (manual) {
    return (
      <div className="field">
        <label>{label}</label>
        <span className="layer-align-spacer" aria-hidden="true">
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
          ⇄ gebruik lagen
        </button>
      </div>
    )
  }

  const { layers, extra } = layerBreakdown(value ?? 0, layerSize)

  return (
    <div className="field">
      <label>{label}</label>
      <div className="layer-stepper-grid">
        <span className="layer-stepper-label">Volle lagen ({layerSize}/laag)</span>
        <span className="layer-stepper-label">Loose extra</span>
        <div className="layer-stepper-controls">
          <button
            type="button"
            className="icon-button"
            onClick={() => onChange(totalFromLayers(Math.max(0, layers - 1), extra, layerSize))}
            aria-label="Fewer layers"
          >
            −
          </button>
          <span className="layer-stepper-value">{layers}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => onChange(totalFromLayers(layers + 1, extra, layerSize))}
            aria-label="More layers"
          >
            +
          </button>
        </div>
        <div className="layer-stepper-controls">
          <button
            type="button"
            className="icon-button"
            onClick={() => onChange(totalFromLayers(layers, Math.max(0, extra - 1), layerSize))}
            aria-label="Fewer extra"
          >
            −
          </button>
          <span className="layer-stepper-value">{extra}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => onChange(totalFromLayers(layers, extra + 1, layerSize))}
            aria-label="More extra"
          >
            +
          </button>
        </div>
      </div>
      <p className="layer-stepper-total">= {totalFromLayers(layers, extra, layerSize)}</p>
      <button type="button" className="link-button" onClick={() => setManual(true)}>
        ⇄ enter number directly
      </button>
    </div>
  )
}
