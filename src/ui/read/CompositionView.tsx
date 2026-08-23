import type { CompositionEntry, Product } from '../../domain/types'
import { relativeDayLabel } from '../../domain/dates'

interface Props {
  product: Product
  composition: CompositionEntry[]
  oldestDate: string | null
  total: number
  unattributed: number
}

export function CompositionView({ product, composition, oldestDate, total, unattributed }: Props) {
  const unit = product.category === 'bulk' ? '%' : ''

  return (
    <div className="sheet">
      <h3>{product.name}</h3>
      <p>
        Current total: <strong>{total}{unit}</strong>
      </p>
      {composition.length === 0 ? (
        <p>No stock currently tracked.</p>
      ) : (
        <div className="composition-list">
          {composition.map((entry) => (
            <div key={entry.date} className={`composition-row${entry.date === oldestDate ? ' oldest' : ''}`}>
              <span className="date-label">{relativeDayLabel(entry.date)}</span>
              <span className="qty">
                {entry.qty}
                {unit}
              </span>
            </div>
          ))}
        </div>
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
