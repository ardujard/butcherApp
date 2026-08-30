import { useState } from 'react'
import type { Category, CheckpointPayload, DomainEvent, Product, TopupPayload } from '../../domain/types'
import { relativeDayLabel } from '../../domain/dates'
import { deleteEvent } from '../../data/eventsRepo'
import { EditEntryModal } from './EditEntryModal'

interface Props {
  product: Product
  events: DomainEvent[] // newest first, already limited to a recent window
  onChanged: () => void
}

function describeEvent(event: DomainEvent, category: Category): string {
  if (event.type === 'topup') {
    const p = event.payload as TopupPayload
    const amount = category === 'discrete' ? `+${p.addedQty}` : `+${p.addedPct}%`
    const total = category === 'discrete' && p.statedTotal != null ? `, total ${p.statedTotal}` : ''
    return `${relativeDayLabel(p.productionDate)} · ${amount}${total}`
  }
  const p = event.payload as CheckpointPayload
  return `Recount: ${p.statedTotal}${category === 'bulk' ? '%' : ''}`
}

export function RecentEntriesList({ product, events, onChanged }: Props) {
  const [editing, setEditing] = useState<DomainEvent | null>(null)

  async function handleDelete(event: DomainEvent) {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return
    await deleteEvent(event.id)
    onChanged()
  }

  if (events.length === 0) return null

  return (
    <div className="entry-list">
      <h3>Recent entries</h3>
      {events.map((event) => (
        <div key={event.id} className="entry-row">
          <span className="details">{describeEvent(event, product.category)}</span>
          <span className="row-actions">
            <button className="icon-button" onClick={() => setEditing(event)} aria-label="Edit entry">
              ✏️
            </button>
            <button className="icon-button" onClick={() => handleDelete(event)} aria-label="Delete entry">
              🗑️
            </button>
          </span>
        </div>
      ))}
      {editing && (
        <EditEntryModal
          product={product}
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}
