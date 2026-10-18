import type { Category } from './types'

/** An optional whole-number setting typed into a form: '' means "not set"
 * (null), anything else must be a whole number of at least `min`. Returns
 * undefined when the text isn't acceptable, so callers can tell "left blank"
 * from "typed something invalid". The inputs' min= attributes only steer the
 * spinner; typed values get past them. */
export function parseOptionalWholeNumber(text: string, min: number): number | null | undefined {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isInteger(n) && n >= min ? n : undefined
}

/** A recounted or stated total: never negative, and for bulk products a
 * share of one container, so no more than 100%. */
export function isValidTotal(value: number, category: Category): boolean {
  return Number.isFinite(value) && value >= 0 && (category !== 'bulk' || value <= 100)
}
