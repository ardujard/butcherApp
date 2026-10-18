import type { DomainEvent } from './types'

/** Once a product has any history, its category and source type can't
 * change. Discrete counts and bulk percentage-points aren't compatible units
 * to replay together, and a stored batch date means a production date for
 * in-house stock but a good-till date for external stock — switching would
 * silently reinterpret every recorded batch, flagging fresh stock as expired
 * or hiding stock that is. Repurpose by archiving and creating a new product
 * instead. */
export function isProductTypeLocked(events: DomainEvent[]): boolean {
  return events.length > 0
}

/** Decomposes a total into layers of a fixed size plus a loose remainder, so
 * staff can build up a count like "2 layers + 3" instead of counting stock
 * one by one. */
export function layerBreakdown(total: number, layerSize: number): { layers: number; extra: number } {
  return { layers: Math.floor(total / layerSize), extra: total % layerSize }
}

export function totalFromLayers(layers: number, extra: number, layerSize: number): number {
  return layers * layerSize + extra
}

/** Amount added, inferred from how many were left before the top-up and the
 * recounted total after — the alternative to counting freshly-added stock
 * directly, which is awkward for items like skewers or sausages. Can go
 * negative if the entered numbers don't add up, which callers should flag. */
export function addedFromLeftBefore(total: number, leftBefore: number): number {
  return total - leftBefore
}
