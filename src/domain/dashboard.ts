import { activeComposition } from './batchEngine'
import { addDays, dayMonth } from './dates'
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
  /** The day this batch was topped up, i.e. when its counter clock started.
   * Null for stock with no recorded top-up. */
  openedOn: string | null
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
  /** This product's soonest-expiring batch: when it goes bad, which limit
   * decides that, and the dates behind it. Null wherever no limit is tracked
   * or there's no dated stock. */
  expiry: BatchExpiry | null
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

  const opened = openedOn ?? null

  if (product.sourceType !== 'external') {
    if (product.lifespanDays == null) return null
    return { batchKey, openedOn: opened, date: addDays(batchKey, product.lifespanDays), reason: 'shelf' }
  }

  const goodTill: BatchExpiry = { batchKey, openedOn: opened, date: batchKey, reason: 'shelf' }
  if (product.lifespanDays == null || opened == null) return goodTill
  const counterDate = addDays(opened, product.lifespanDays)
  return counterDate < batchKey
    ? { batchKey, openedOn: opened, date: counterDate, reason: 'counter' }
    : goodTill
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

function days(n: number): string {
  return `${n} ${n === 1 ? 'dag' : 'dagen'}`
}

/** How much longer a batch may stay out on the counter, in Dutch. */
function counterClause(daysRemaining: number): string {
  if (daysRemaining > 0) return `kan nog ${days(daysRemaining)} in de toog blijven liggen`
  if (daysRemaining === 0) return 'moet vandaag uit de toog'
  return `moest ${days(-daysRemaining)} geleden al uit de toog`
}

/**
 * Dutch second line for a batch on a product's control page: the date the
 * batch itself carries, and — only once a lifespan is configured, since
 * that's what puts a clock on it — how much longer it may stay out.
 */
export function batchDetailLabel(
  batchKey: string,
  sourceType: SourceType,
  lifespanDays: number | null,
  daysRemaining: number | null,
): string {
  const carried =
    sourceType === 'external'
      ? `Originele houdbaarheidsdatum: ${dayMonth(batchKey)}`
      : `Productiedatum: ${dayMonth(batchKey)}`
  if (lifespanDays == null || daysRemaining == null) return carried
  return `${carried}, ${counterClause(daysRemaining)}`
}

/**
 * Dutch sentence explaining why a product is on the oldest-stock list: which
 * limit caught it, and the dates behind that. Shown behind the info control
 * on each row, where the one-word tag alone doesn't say enough to act on.
 *
 * Null when nothing is tracked, which is also when there's no info control.
 */
export function expiryExplanation(entry: Pick<OldestItemEntry, 'expiry' | 'lifespanDays' | 'sourceType'>): string | null {
  const { expiry, lifespanDays } = entry
  if (expiry == null) return null

  if (expiry.reason === 'counter') {
    // openedOn is always set when the counter window is what binds.
    return (
      `Dit product werd aangevuld op ${dayMonth(expiry.openedOn!)} en staat ingesteld op max ` +
      `${lifespanDays} dagen in de toog, dus tot ${dayMonth(expiry.date)}. ` +
      `De houdbaarheidsdatum van de verpakking was ${dayMonth(expiry.batchKey)}.`
    )
  }

  if (entry.sourceType === 'external') {
    const opened = expiry.openedOn ? ` Het werd aangevuld op ${dayMonth(expiry.openedOn)}.` : ''
    return `Dit product heeft maar een houdbaarheid tot ${dayMonth(expiry.date)}.${opened}`
  }

  return (
    `Dit product is geproduceerd op ${dayMonth(expiry.batchKey)} en is ${lifespanDays} dagen ` +
    `houdbaar, dus tot ${dayMonth(expiry.date)}.`
  )
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
