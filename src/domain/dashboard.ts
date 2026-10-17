import { activeComposition } from './batchEngine'
import { addDays, relativeDayLabel } from './dates'
import { UNKNOWN_DATE, type Product, type ReplayResult, type SourceType } from './types'

/** Which limit decides a batch's expiry date. 'shelf' is the product's own
 * shelf life — production date plus lifespan for in-house stock, or an
 * external pack's good-till date. 'counter' is the shorter window that starts
 * when an external pack is opened out onto the counter, losing whatever its
 * sealed packaging was buying it. */
export type ExpiryReason = 'shelf' | 'counter'

export interface BatchExpiry {
  /** The batch's own date: a production date (in-house) or a good-till date
   * (external). What staff recognise the batch by. */
  batchKey: string
  /** The day the batch actually goes bad, per whichever limit binds first. */
  date: string
  reason: ExpiryReason
}

export interface OldestItemEntry {
  productId: string
  productName: string
  sourceType: SourceType
  oldestDate: string | null
  lifespanDays: number | null
  /** Whole days from today until `expiryDate`, negative once it's passed.
   * Null wherever no limit is tracked or there's no dated stock. */
  daysRemaining: number | null
  /** The day this product's soonest-expiring batch goes bad, and why. Null
   * wherever no limit is tracked or there's no dated stock. */
  expiryDate: string | null
  expiryReason: ExpiryReason | null
}

export type LifespanStatus = 'ok' | 'warning' | 'exceeded'

/** How close to its lifespan limit a batch must be before the control page
 * flags it: 1 day remaining or less is a warning, 0 or fewer is exceeded.
 * Fixed-day cutoff (not a percentage of lifespan), so every product gets the
 * same "heads up, by tomorrow" signal regardless of its own lifespan length. */
export const LIFESPAN_WARNING_DAYS = 1

export function lifespanStatus(daysRemaining: number | null): LifespanStatus | null {
  if (daysRemaining == null) return null
  if (daysRemaining <= 0) return 'exceeded'
  if (daysRemaining <= LIFESPAN_WARNING_DAYS) return 'warning'
  return 'ok'
}

type ExpiryRules = Pick<Product, 'sourceType' | 'lifespanDays'>

/**
 * When a single batch goes bad, and which limit decides it.
 *
 * In-house stock counts its lifespan from the production date. External stock
 * is bound by whichever comes first: its good-till date, or the counter window
 * that started when it was topped up — a sealed pack's good-till date is only
 * honest while it's still sealed.
 *
 * Null when nothing limits the batch: an in-house product with no lifespan
 * set, or the unattributable UNKNOWN_DATE bucket, which has no date to count
 * from in the first place.
 */
export function batchExpiry(
  batchKey: string,
  openedOn: string | undefined,
  product: ExpiryRules,
): BatchExpiry | null {
  if (batchKey === UNKNOWN_DATE) return null

  if (product.sourceType !== 'external') {
    if (product.lifespanDays == null) return null
    return { batchKey, date: addDays(batchKey, product.lifespanDays), reason: 'shelf' }
  }

  const goodTill: BatchExpiry = { batchKey, date: batchKey, reason: 'shelf' }
  if (product.lifespanDays == null || openedOn == null) return goodTill
  const counterDate = addDays(openedOn, product.lifespanDays)
  return counterDate < batchKey ? { batchKey, date: counterDate, reason: 'counter' } : goodTill
}

/**
 * The batch that goes bad soonest across a product's active stock.
 *
 * Not necessarily the oldest batch: an external pack with a distant good-till
 * date that has been sitting open on the counter for days expires before a
 * freshly opened pack whose good-till date is nearer. So this scans every
 * active batch rather than reading off the oldest date.
 */
export function soonestBatchExpiry(replay: ReplayResult, product: ExpiryRules): BatchExpiry | null {
  let soonest: BatchExpiry | null = null
  for (const entry of activeComposition(replay)) {
    const expiry = batchExpiry(entry.date, replay.openedOn[entry.date], product)
    if (expiry != null && (soonest == null || expiry.date < soonest.date)) soonest = expiry
  }
  return soonest
}

export function reasonLabel(reason: ExpiryReason): string {
  return reason === 'counter' ? 'toonbank' : 'houdbaar'
}

/** Dutch one-liner spelling out a batch's real deadline, e.g. "toonbank t/m
 * 19/10 · nog 2 dagen". The date is dropped when it's the same one already
 * shown as the batch's own date, which would just read twice over. */
export function expiryNoteLabel(expiry: BatchExpiry, daysRemaining: number, from: Date = new Date()): string {
  const what = reasonLabel(expiry.reason)
  if (daysRemaining < 0) {
    const late = -daysRemaining
    return `${what} · ${late} ${late === 1 ? 'dag' : 'dagen'} te laat`
  }
  if (daysRemaining === 0) return `${what} t/m vandaag`
  if (daysRemaining === 1) return `${what} t/m morgen`
  if (expiry.date === expiry.batchKey) return `${what} · nog ${daysRemaining} dagen`
  return `${what} t/m ${relativeDayLabel(expiry.date, from)} · nog ${daysRemaining} dagen`
}

/** Products with the oldest at-risk stock first; products with no dated
 * stock (null) sort last. */
export function sortOldestFirst(entries: OldestItemEntry[]): OldestItemEntry[] {
  return entries.slice().sort((a, b) => {
    if (a.oldestDate == null && b.oldestDate == null) return 0
    if (a.oldestDate == null) return 1
    if (b.oldestDate == null) return -1
    return a.oldestDate < b.oldestDate ? -1 : a.oldestDate > b.oldestDate ? 1 : 0
  })
}

/** Products closest to expiring first, whichever limit binds; products with
 * nothing tracked, or no dated stock, sort last. */
export function sortByLifespanRemaining(entries: OldestItemEntry[]): OldestItemEntry[] {
  return entries.slice().sort((a, b) => {
    if (a.daysRemaining == null && b.daysRemaining == null) return 0
    if (a.daysRemaining == null) return 1
    if (b.daysRemaining == null) return -1
    return a.daysRemaining - b.daysRemaining
  })
}
