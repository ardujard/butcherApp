export type Category = 'discrete' | 'bulk'

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
  archived: boolean
  createdAt: string
}

export type EventType = 'topup' | 'checkpoint'

export interface TopupPayload {
  productionDate: string // 'YYYY-MM-DD'
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
  deleted: boolean
  deletedAt?: string
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
