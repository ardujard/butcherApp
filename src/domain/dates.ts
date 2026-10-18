const DAY_MS = 24 * 60 * 60 * 1000

// All date-only arithmetic is done in UTC and only ever formatted back out as
// 'YYYY-MM-DD'. This keeps day-boundary math independent of the device's
// local timezone offset, which would otherwise silently shift dates near
// midnight when converted through toISOString().
function atUTCMidnight(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00Z`)
}

function utcISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** The calendar day a moment falls on where the device is, as 'YYYY-MM-DD'.
 * The one place a real clock reading becomes a date: not via toISOString(),
 * which gives the UTC day — still yesterday in Belgium until 01:00 (02:00
 * in summer). */
export function toISODate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function addDays(dateISO: string, delta: number): string {
  const d = atUTCMidnight(dateISO)
  d.setUTCDate(d.getUTCDate() + delta)
  return utcISODate(d)
}

/** Last `n` calendar days including today, newest first. */
export function lastNDays(n: number, from: Date = new Date()): string[] {
  const today = toISODate(from)
  return Array.from({ length: n }, (_, i) => addDays(today, -i))
}

/** Next `n` calendar days including today, soonest first. */
export function nextNDays(n: number, from: Date = new Date()): string[] {
  const today = toISODate(from)
  return Array.from({ length: n }, (_, i) => addDays(today, i))
}

/** Whole calendar days from `startISO` to `endISO` (positive if `endISO` is later). */
export function daysBetween(startISO: string, endISO: string): number {
  return Math.round((atUTCMidnight(endISO).getTime() - atUTCMidnight(startISO).getTime()) / DAY_MS)
}

/** Plain 'dd/mm', with no "Today" substitution — for prose, where a
 * substituted word reads wrong mid-sentence. */
export function dayMonth(dateISO: string): string {
  const d = atUTCMidnight(dateISO)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

export function relativeDayLabel(dateISO: string, from: Date = new Date()): string {
  const today = toISODate(from)
  const diffDays = Math.round((atUTCMidnight(dateISO).getTime() - atUTCMidnight(today).getTime()) / DAY_MS)

  if (diffDays === 0) return 'Today'
  return dayMonth(dateISO)
}
