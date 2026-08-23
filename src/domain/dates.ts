const DAY_MS = 24 * 60 * 60 * 1000
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// All date-only arithmetic is done in UTC and only ever formatted back out as
// 'YYYY-MM-DD'. This keeps day-boundary math independent of the device's
// local timezone offset, which would otherwise silently shift dates near
// midnight when converted through toISOString().
function atUTCMidnight(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00Z`)
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(dateISO: string, delta: number): string {
  const d = atUTCMidnight(dateISO)
  d.setUTCDate(d.getUTCDate() + delta)
  return toISODate(d)
}

/** Last `n` calendar days including today, newest first. */
export function lastNDays(n: number, from: Date = new Date()): string[] {
  const today = toISODate(from)
  return Array.from({ length: n }, (_, i) => addDays(today, -i))
}

export function relativeDayLabel(dateISO: string, from: Date = new Date()): string {
  const today = toISODate(from)
  const diffDays = Math.round((atUTCMidnight(dateISO).getTime() - atUTCMidnight(today).getTime()) / DAY_MS)

  if (diffDays === 0) return 'Today'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays < 0 && diffDays > -7) return DAY_NAMES[atUTCMidnight(dateISO).getUTCDay()]

  const d = atUTCMidnight(dateISO)
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`
}
