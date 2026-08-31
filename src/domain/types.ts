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
  /** Days of shelf life from production date before stock is flagged as
   * exceeded on the control page. Null means lifespan isn't tracked for this
   * product. */
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
