import { lifespanStatus, type LifespanStatus } from '../../domain/dashboard'
import { relativeDayLabel } from '../../domain/dates'
import { useOldestItemsDashboard } from '../../state/useOldestItemsDashboard'

interface Props {
  onBack: () => void
  onSelectProduct: (productId: string) => void
}

const STATUS_CLASS: Record<LifespanStatus, string> = {
  ok: 'lifespan-ok',
  warning: 'lifespan-warning',
  exceeded: 'lifespan-exceeded',
}

export function OldestItemsDashboard({ onBack, onSelectProduct }: Props) {
  const { entries, loading, sortMode, setSortMode } = useOldestItemsDashboard()
  const dated = entries.filter((e) => e.oldestDate != null)

  return (
    <div>
      <button className="back-button" onClick={onBack} aria-label="Back">
        ←
      </button>
      <h2>Oldest stock</h2>
      <div className="sort-toggle" style={{ marginBottom: 12 }}>
        <button className={sortMode === 'oldest-date' ? 'active' : ''} onClick={() => setSortMode('oldest-date')}>
          Oldest production date
        </button>
        <button className={sortMode === 'lifespan' ? 'active' : ''} onClick={() => setSortMode('lifespan')}>
          Closest to expiring
        </button>
      </div>
      {sortMode === 'oldest-date' && (
        <p className="hint-note">External products (tracked by a good-till date) aren't shown in this view.</p>
      )}
      {loading ? (
        <p>Loading…</p>
      ) : dated.length === 0 ? (
        <p className="empty-state">No dated stock currently tracked.</p>
      ) : (
        <div className="composition-list">
          {dated.map((entry) => {
            const status = lifespanStatus(entry.daysRemaining)
            const rowClass = status ? STATUS_CLASS[status] : 'oldest'
            // In "closest to expiring" mode, show the date the entry actually
            // expires (production date + lifespan, or the good-till date) —
            // falling back to the production date itself for a product with
            // no lifespan tracked, since there's nothing else to show.
            const dateShown =
              sortMode === 'lifespan' ? (entry.expiryDate ?? entry.oldestDate!) : entry.oldestDate!
            return (
              <button
                key={entry.productId}
                className={`composition-row ${rowClass}`}
                onClick={() => onSelectProduct(entry.productId)}
              >
                <span className="date-label">{entry.productName}</span>
                <span className="qty">{relativeDayLabel(dateShown)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
