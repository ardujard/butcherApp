import { relativeDayLabel } from '../../domain/dates'
import { useOldestItemsDashboard } from '../../state/useOldestItemsDashboard'

interface Props {
  onBack: () => void
}

export function OldestItemsDashboard({ onBack }: Props) {
  const { entries, loading } = useOldestItemsDashboard()
  const dated = entries.filter((e) => e.oldestDate != null)

  return (
    <div>
      <button className="back-button" onClick={onBack} aria-label="Back">
        ←
      </button>
      <h2>Oldest stock</h2>
      {loading ? (
        <p>Loading…</p>
      ) : dated.length === 0 ? (
        <p className="empty-state">No dated stock currently tracked.</p>
      ) : (
        <div className="composition-list">
          {dated.map((entry) => (
            <div key={entry.productId} className="composition-row oldest">
              <span className="date-label">{entry.productName}</span>
              <span className="qty">{relativeDayLabel(entry.oldestDate!)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
