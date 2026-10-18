import type { Product } from '../../domain/types'
import { batchDetailLabel, lifespanStatus, type LifespanStatus } from '../../domain/dashboard'
import { dayMonth } from '../../domain/dates'
import type { CompositionRow } from '../../state/useProductComposition'

interface Props {
  product: Product
  composition: CompositionRow[]
  total: number
  unattributed: number
}

const STATUS_CLASS: Record<LifespanStatus, string> = {
  ok: 'lifespan-ok',
  warning: 'lifespan-warning',
  exceeded: 'lifespan-exceeded',
}

export function CompositionView({ product, composition, total, unattributed }: Props) {
  const unit = product.category === 'bulk' ? '%' : ''
  const hasCounterWindow = product.lifespanDays != null

  return (
    <div className="sheet">
      <h3>{product.name}</h3>
      <p>
        Current total: <strong>{total}{unit}</strong>
      </p>
      {composition.length === 0 ? (
        <p>No stock currently tracked.</p>
      ) : (
        <>
          {hasCounterWindow && (
            <p className="hint-note">Max {product.lifespanDays} dagen in de toog na aanvullen.</p>
          )}
          <div className="composition-list">
            {composition.map((entry) => {
              const status = lifespanStatus(entry.daysRemaining)
              return (
                <div key={entry.date} className={`composition-row ${status ? STATUS_CLASS[status] : ''}`}>
                  <span className="date-label">
                    <span className="topup-line">
                      aangevuld op {entry.openedOn ? dayMonth(entry.openedOn) : 'onbekend'}
                    </span>
                    <small className="batch-detail">
                      {batchDetailLabel(entry.date, product.sourceType, product.lifespanDays, entry.daysRemaining)}
                    </small>
                  </span>
                  <span className="qty">
                    {entry.qty}
                    {unit}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
      {unattributed > 0 && (
        <div className="warning-banner">
          {unattributed}
          {unit} unaccounted for — review recent entries below to correct it.
        </div>
      )}
    </div>
  )
}
