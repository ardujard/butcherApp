import { useRef, useState } from 'react'
import { exportBackup, importBackup, parseBackup } from '../../data/backupRepo'
import { toISODate } from '../../domain/dates'
import { BigButton } from '../shared/BigButton'

export function BackupAdmin() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null)

  async function handleDownload() {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock-tracker-backup-${toISODate(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ text: 'Backup downloaded.', kind: 'success' })
  }

  function handleRestoreClick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const backup = parseBackup(await file.text())
      const confirmed = window.confirm(
        `This replaces all current products, labels, and history with the ${backup.labels.length} label(s), ` +
          `${backup.products.length} product(s), and ${backup.events.length} entr${backup.events.length === 1 ? 'y' : 'ies'} ` +
          `in this backup (from ${backup.exportedAt.slice(0, 10)}). This cannot be undone. Continue?`,
      )
      if (!confirmed) return

      await importBackup(backup)
      setMessage({ text: 'Backup restored. Reloading…', kind: 'success' })
      window.location.reload()
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Restore failed.', kind: 'error' })
    }
  }

  return (
    <div>
      <div className="sheet">
        <h3>Download backup</h3>
        <p className="empty-state" style={{ padding: 0, textAlign: 'left' }}>
          Saves all products, labels, and stock history to a JSON file on this iPad. Use this regularly so you can
          recover if local storage is ever lost.
        </p>
        <div className="actions-row" style={{ justifyContent: 'flex-start' }}>
          <BigButton variant="primary" onClick={handleDownload}>
            Download backup
          </BigButton>
        </div>
      </div>

      <div className="sheet" style={{ marginTop: 20 }}>
        <h3>Restore from backup</h3>
        <p className="empty-state" style={{ padding: 0, textAlign: 'left' }}>
          Replaces everything currently on this iPad with the contents of a backup file.
        </p>
        <div className="actions-row" style={{ justifyContent: 'flex-start' }}>
          <BigButton variant="danger" onClick={handleRestoreClick}>
            Restore from file
          </BigButton>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
      </div>

      {message && (
        <div className={message.kind === 'error' ? 'warning-banner' : 'success-banner'} style={{ marginTop: 16 }}>
          {message.text}
        </div>
      )}
    </div>
  )
}
