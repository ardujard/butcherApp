import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, lastNDays, nextNDays, relativeDayLabel } from '../dates'

describe('addDays', () => {
  it('adds and subtracts days across month boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })
})

describe('lastNDays', () => {
  it('returns the last n days newest first, including today', () => {
    const days = lastNDays(7, new Date('2026-08-23T12:00:00Z'))
    expect(days).toEqual(['2026-08-23', '2026-08-22', '2026-08-21', '2026-08-20', '2026-08-19', '2026-08-18', '2026-08-17'])
  })
})

describe('nextNDays', () => {
  it('returns the next n days soonest first, including today', () => {
    const days = nextNDays(4, new Date('2026-08-23T12:00:00Z'))
    expect(days).toEqual(['2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26'])
  })
})

describe('daysBetween', () => {
  it('counts whole days from start to end', () => {
    expect(daysBetween('2026-08-20', '2026-08-23')).toBe(3)
  })

  it('is negative when end is before start', () => {
    expect(daysBetween('2026-08-23', '2026-08-20')).toBe(-3)
  })
})

describe('relativeDayLabel', () => {
  const from = new Date('2026-08-23T12:00:00Z') // a Sunday

  it('labels today', () => {
    expect(relativeDayLabel('2026-08-23', from)).toBe('Today')
  })

  it('labels yesterday and the rest of the last 7 days as dd/mm', () => {
    expect(relativeDayLabel('2026-08-22', from)).toBe('22/08')
    expect(relativeDayLabel('2026-08-21', from)).toBe('21/08')
  })

  it('falls back to dd/mm beyond the last 7 days', () => {
    expect(relativeDayLabel('2026-08-10', from)).toBe('10/08')
  })

  it('zero-pads single-digit day and month', () => {
    expect(relativeDayLabel('2026-08-05', from)).toBe('05/08')
  })
})
