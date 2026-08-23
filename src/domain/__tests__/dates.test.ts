import { describe, expect, it } from 'vitest'
import { addDays, lastNDays, relativeDayLabel } from '../dates'

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

describe('relativeDayLabel', () => {
  const from = new Date('2026-08-23T12:00:00Z') // a Sunday

  it('labels today and yesterday', () => {
    expect(relativeDayLabel('2026-08-23', from)).toBe('Today')
    expect(relativeDayLabel('2026-08-22', from)).toBe('Yesterday')
  })

  it('labels the rest of the last 7 days by weekday name', () => {
    expect(relativeDayLabel('2026-08-21', from)).toBe('Friday')
  })

  it('falls back to a short date beyond the last 7 days', () => {
    expect(relativeDayLabel('2026-08-10', from)).toBe('10 Aug')
  })
})
