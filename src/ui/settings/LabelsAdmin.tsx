import { useCallback, useEffect, useState } from 'react'
import type { Label } from '../../domain/types'
import { archiveLabel, createLabel, isLabelInUse, listLabels, renameLabel, restoreLabel } from '../../data/labelsRepo'
import { BigButton } from '../shared/BigButton'

export function LabelsAdmin() {
  const [labels, setLabels] = useState<Label[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const reload = useCallback(async () => setLabels(await listLabels(true)), [])
  useEffect(() => {
    reload()
  }, [reload])

  async function handleAdd() {
    if (!name.trim()) return
    await createLabel(name.trim())
    setName('')
    reload()
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) return
    await renameLabel(id, editingName.trim())
    setEditingId(null)
    reload()
  }

  async function handleArchive(label: Label) {
    if (await isLabelInUse(label.id)) {
      setError(`"${label.name}" is still assigned to a product — reassign it first.`)
      return
    }
    setError(null)
    await archiveLabel(label.id)
    reload()
  }

  async function handleRestore(label: Label) {
    await restoreLabel(label.id)
    reload()
  }

  const visible = labels.filter((l) => showArchived || !l.archived)

  return (
    <div>
      <div className="sheet">
        <h3>New label</h3>
        <div className="field-row">
          <div className="field" style={{ flex: 1 }}>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Burgers" />
          </div>
          <BigButton variant="primary" onClick={handleAdd} disabled={!name.trim()}>
            Add label
          </BigButton>
        </div>
      </div>

      {error && (
        <div className="warning-banner" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>

      <div className="admin-list" style={{ marginTop: 12 }}>
        {visible.map((label) => (
          <div key={label.id} className="admin-row">
            {editingId === label.id ? (
              <input value={editingName} onChange={(e) => setEditingName(e.target.value)} autoFocus />
            ) : (
              <span>
                {label.name}
                {label.archived ? ' (archived)' : ''}
              </span>
            )}
            <span className="row-actions">
              {label.archived ? (
                <BigButton onClick={() => handleRestore(label)}>Restore</BigButton>
              ) : editingId === label.id ? (
                <BigButton onClick={() => handleRename(label.id)}>Save</BigButton>
              ) : (
                <>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditingId(label.id)
                      setEditingName(label.name)
                    }}
                    aria-label="Rename"
                  >
                    ✏️
                  </button>
                  <button className="icon-button" onClick={() => handleArchive(label)} aria-label="Archive">
                    🗑️
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
        {visible.length === 0 && <p className="empty-state">No labels yet.</p>}
      </div>
    </div>
  )
}
