import type { Product } from '../../domain/types'
import { expiryNoteLabel, lifespanStatus, type LifespanStatus } from '../../domain/dashboard'
import { relativeDayLabel } from '../../domain/dates'
import type { CompositionRow } from '../../state/useProductComposition'

interface Props {
  product: Product
  composition: CompositionRow[]
  oldestDate: string | null
  total: number
  unattributed: number
}

const STATUS_CLASS: Record<LifespanStatus, string> = {
  ok: 'lifespan-ok',
  warning: 'lifespan-warning',
  exceeded: 'lifespan-exceeded',
}

export function CompositionView({ product, composition, oldestDate, total, unattributed }: Props) {
  const unit = product.category === 'bulk' ? '%' : ''
  const isExternal = product.sourceType === 'external'
  const hasCounterWindow = isExternal && product.lifespanDays != null

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
          <p className="hint-note">
            {isExternal ? 'Datums hieronder zijn houdbaar-tot-datums.' : 'Datums hieronder zijn productiedatums.'}
            {hasCounterWindow && ` Max ${product.lifespanDays} dagen in de toonbank na bijvullen.`}
          </p>
          <div className="composition-list">
            {composition.map((entry) => {
              const status = lifespanStatus(entry.daysRemaining)
              // Status wins over the plain "oldest" marker: once a real
              // deadline is known, that's the thing worth colouring by.
              const rowClass = status
                ? STATUS_CLASS[status]
                : entry.date === oldestDate
                  ? 'oldest'
                  : ''
              return (
                <div key={entry.date} className={`composition-row ${rowClass}`}>
                  <span className="date-label">
                    {relativeDayLabel(entry.date)}
                    {entry.expiry && (
                      <small className={`expiry-note expiry-${entry.expiry.reason}`}>
                        {expiryNoteLabel(entry.expiry, entry.daysRemaining!)}
                      </small>
                    )}
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
