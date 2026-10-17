export type Category = 'discrete' | 'bulk'

/** Whether a product is made on-site (tracked by production date, FIFO
 * batches) or brought in from outside (tracked by a good-till date instead —
 * it has no "made here" date to sort by). */
export type SourceType = 'in house' | 'external'

export interface Label {
  id: string
  name: string
  archived: boolean
  createdAt: string
}

export interface Product {
  id: string
  name: string
  category: Category
  labelId: string | null
  sourceType: SourceType
  /** Days of shelf life before stock is flagged as exceeded on the control
   * page. The clock starts at the production date for in-house products; for
   * external products — which have no production date — it starts when the
   * batch is topped up into the counter, so a professionally sealed pack
   * keeps its distant good-till date right up until it's opened out onto the
   * counter. Null means no limit is tracked for this product. */
  lifespanDays: number | null
  /** Standard batch size (e.g. a tray of 8 skewers) used to build up a
   * top-up total as "2 layers + 3" instead of a raw count. Null means layer
   * entry isn't offered for this product. */
  layerSize: number | null
  archived: boolean
  createdAt: string
}

export type EventType = 'topup' | 'checkpoint'

export interface TopupPayload {
  productionDate: string // 'YYYY-MM-DD'; for external products this holds the good-till date instead
  addedQty?: number // discrete category, raw units
  addedPct?: number // bulk category, percentage points 0-100
  statedTotal?: number // discrete category only: post-add recount
}

export interface CheckpointPayload {
  statedTotal: number // physical recount, raw units (discrete) or percentage points (bulk)
}

export interface DomainEvent {
  id: number
  productId: string
  type: EventType
  recordedAt: string // ISO datetime; fixes replay order, never edited
  editedAt?: string
  payload: TopupPayload | CheckpointPayload
}

export const UNKNOWN_DATE = 'unknown'

export interface ReplayResult {
  /** productionDate ('YYYY-MM-DD') or UNKNOWN_DATE -> remaining qty */
  batches: Record<string, number>
  /**
   * Batch key -> the day its earliest top-up was recorded, i.e. when it went
   * out onto the counter. Earliest rather than latest because top-ups sharing
   * one batch key but entered on different days merge into a single batch
   * that FIFO can no longer tell apart, so the earliest is the only safe
   * assumption. Only top-ups record a date here; the UNKNOWN_DATE bucket
   * never gets one.
   */
  openedOn: Record<string, string>
  /**
   * Total quantity a recount claimed was consumed that the FIFO depletion
   * couldn't actually account for (i.e. the stated total implied more
   * shrinkage than the recorded stock could explain). Surfaced as a
   * data-quality warning, never silently forced into the numbers.
   */
  unexplainedShortfall: number
}

export interface CompositionEntry {
  date: string
  qty: number
}
