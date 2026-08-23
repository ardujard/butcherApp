import { useMemo, useState } from 'react'
import { lastNDays, relativeDayLabel, toISODate } from '../../domain/dates'
import { useRecentProductionDates } from '../../state/useRecentProductionDates'
import { Chip } from '../shared/Chip'

interface Props {
  value: string
  onChange: (date: string) => void
}

export function ProductionDateChips({ value, onChange }: Props) {
  const recent = useRecentProductionDates(2)
  const last7 = useMemo(() => lastNDays(7), [])
  const [showOther, setShowOther] = useState(() => value !== '' && !last7.includes(value))

  const extraRecent = recent.filter((d) => !last7.includes(d))
  const options = [...last7, ...extraRecent]

  return (
    <div className="field">
      <label>Production date</label>
      <div className="chip-row">
        {options.map((date) => (
          <Chip
            key={date}
            label={relativeDayLabel(date)}
            selected={!showOther && value === date}
            onClick={() => {
              setShowOther(false)
              onChange(date)
            }}
          />
        ))}
        <Chip label="Other" selected={showOther} onClick={() => setShowOther(true)} />
      </div>
      {showOther && (
        <input type="date" value={value} max={toISODate(new Date())} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}
