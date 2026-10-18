import { describe, expect, it } from 'vitest'
import { isValidTotal, parseOptionalWholeNumber } from '../validation'

describe('parseOptionalWholeNumber', () => {
  it('treats blank as not set', () => {
    expect(parseOptionalWholeNumber('', 1)).toBeNull()
    expect(parseOptionalWholeNumber('  ', 1)).toBeNull()
  })

  it('accepts whole numbers at or above the minimum', () => {
    expect(parseOptionalWholeNumber('8', 1)).toBe(8)
    expect(parseOptionalWholeNumber('0', 0)).toBe(0)
  })

  it('rejects values below the minimum, fractions and junk', () => {
    expect(parseOptionalWholeNumber('0', 1)).toBeUndefined()
    expect(parseOptionalWholeNumber('-2', 0)).toBeUndefined()
    expect(parseOptionalWholeNumber('2.5', 1)).toBeUndefined()
    expect(parseOptionalWholeNumber('abc', 1)).toBeUndefined()
  })
})

describe('isValidTotal', () => {
  it('rejects negative totals', () => {
    expect(isValidTotal(-1, 'discrete')).toBe(false)
    expect(isValidTotal(0, 'discrete')).toBe(true)
  })

  it('caps bulk totals at a full container', () => {
    expect(isValidTotal(100, 'bulk')).toBe(true)
    expect(isValidTotal(120, 'bulk')).toBe(false)
    expect(isValidTotal(120, 'discrete')).toBe(true)
  })

  it('rejects NaN', () => {
    expect(isValidTotal(Number.NaN, 'discrete')).toBe(false)
  })
})
