import { useMemo, useState } from 'react'
import { lastNDays, nextNDays, relativeDayLabel, toISODate } from '../../domain/dates'
import { useRecentProductionDates } from '../../state/useRecentProductionDates'
import { Chip } from '../shared/Chip'

interface Props {
  value: string
  onChange: (date: string) => void
  /** 'production' (default): past dates, oldest quick-picks first, capped at
   * today. 'goodTill': for external products — future dates, soonest first,
   * floored at today. */
  mode?: 'production' | 'goodTill'
}

export function ProductionDateChips({ value, onChange, mode = 'production' }: Props) {
  const isGoodTill = mode === 'goodTill'
  const recent = useRecentProductionDates(isGoodTill ? 0 : 2)
  const last7 = useMemo(() => lastNDays(7), [])
  const next7 = useMemo(() => nextNDays(7), [])
  const [showOther, setShowOther] = useState(() => {
    const options = isGoodTill ? next7 : last7
    return value !== '' && !options.includes(value)
  })

  let options: string[]
  if (isGoodTill) {
    options = next7
  } else {
    const extraRecent = recent.filter((d) => !last7.includes(d))
    // last7/extraRecent are newest first; reverse so oldest is leftmost and today is rightmost.
    options = [...last7, ...extraRecent].reverse()
  }

  return (
    <div className="field">
      <label>{isGoodTill ? 'Good till date' : 'Production date'}</label>
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
        <input
          type="date"
          value={value}
          min={isGoodTill ? toISODate(new Date()) : undefined}
          max={isGoodTill ? undefined : toISODate(new Date())}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
