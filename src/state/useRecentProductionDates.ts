import { useEffect, useState } from 'react'
import { recentProductionDates } from '../data/eventsRepo'

/** The globally most-recently-used production dates, for quick-pick chips —
 * the same date is usually reused across several products on the same day. */
export function useRecentProductionDates(limit = 2): string[] {
  const [dates, setDates] = useState<string[]>([])

  useEffect(() => {
    recentProductionDates(limit).then(setDates)
  }, [limit])

  return dates
}
