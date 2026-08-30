import type { DomainEvent } from './types'

/**
 * Rolling-window use frequency, not an all-time counter: a product that was
 * popular months ago shouldn't permanently outrank one that's hot right now.
 * `events` should already be scoped to one product (e.g. via an indexed
 * range query) before counting.
 */
export function countRecentEvents(events: DomainEvent[], windowDays: number, from: Date = new Date()): number {
  const cutoff = from.getTime() - windowDays * 24 * 60 * 60 * 1000
  return events.filter((e) => new Date(e.recordedAt).getTime() >= cutoff).length
}
