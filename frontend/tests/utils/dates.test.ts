import { describe, it, expect } from 'vitest'
import {
  parseISODateToUTC,
  isValidDateString,
  validateDateRange,
  calculateDurationDays,
  isHistoricalDate,
  formatDisplayDate,
} from '../../src/utils/dates'

describe('Date & Duration Utilities (src/utils/dates.ts)', () => {
  describe('parseISODateToUTC & isValidDateString', () => {
    it('correctly parses valid ISO date strings', () => {
      const utc = parseISODateToUTC('2026-06-10')
      expect(utc).toBe(Date.UTC(2026, 5, 10))
      expect(isValidDateString('2026-06-10')).toBe(true)
    })

    it('rejects invalid formatting and non-strings', () => {
      expect(parseISODateToUTC('')).toBeNull()
      expect(parseISODateToUTC('06/10/2026')).toBeNull()
      expect(parseISODateToUTC('2026-6-1')).toBeNull()
      expect(parseISODateToUTC('invalid')).toBeNull()
      // @ts-expect-error testing invalid input types
      expect(parseISODateToUTC(null)).toBeNull()
      // @ts-expect-error testing invalid input types
      expect(parseISODateToUTC(undefined)).toBeNull()
    })

    it('rejects impossible calendar dates (non-leap year Feb 29, April 31)', () => {
      // 2026 is not a leap year
      expect(parseISODateToUTC('2026-02-29')).toBeNull()
      expect(isValidDateString('2026-02-29')).toBe(false)

      // April only has 30 days
      expect(parseISODateToUTC('2026-04-31')).toBeNull()
      expect(isValidDateString('2026-04-31')).toBe(false)
    })

    it('accepts leap year February 29th', () => {
      // 2028 is a leap year
      expect(parseISODateToUTC('2028-02-29')).toBe(Date.UTC(2028, 1, 29))
      expect(isValidDateString('2028-02-29')).toBe(true)
    })
  })

  describe('validateDateRange & calculateDurationDays', () => {
    it('calculates 1 day for a same-day trip (startDate === endDate)', () => {
      const validation = validateDateRange('2026-06-10', '2026-06-10')
      expect(validation.isValid).toBe(true)
      expect(validation.durationDays).toBe(1)
      expect(calculateDurationDays('2026-06-10', '2026-06-10')).toBe(1)
    })

    it('calculates 8 days for a standard one-week trip (inclusive)', () => {
      const duration = calculateDurationDays('2026-06-10', '2026-06-17')
      expect(duration).toBe(8)
    })

    it('correctly calculates duration across year boundaries', () => {
      // Dec 28, 2026 to Jan 3, 2027: 4 days in Dec (28, 29, 30, 31) + 3 days in Jan (1, 2, 3) = 7 days
      const duration = calculateDurationDays('2026-12-28', '2027-01-03')
      expect(duration).toBe(7)
    })

    it('correctly calculates duration across leap day in a leap year', () => {
      // Feb 27 to Mar 2 in leap year 2028: 27, 28, 29, 1, 2 = 5 days
      const duration = calculateDurationDays('2028-02-27', '2028-03-02')
      expect(duration).toBe(5)
    })

    it('fails validation when endDate is before startDate', () => {
      const result = validateDateRange('2026-06-17', '2026-06-10')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('End date cannot be earlier than start date')
      expect(() => calculateDurationDays('2026-06-17', '2026-06-10')).toThrowError(
        'End date cannot be earlier than start date'
      )
    })

    it('fails validation when start or end date is malformed', () => {
      const result1 = validateDateRange('invalid', '2026-06-10')
      expect(result1.isValid).toBe(false)
      expect(result1.error).toContain('Start date is missing, malformed')

      const result2 = validateDateRange('2026-06-10', '2026-02-30')
      expect(result2.isValid).toBe(false)
      expect(result2.error).toContain('End date is missing, malformed')
    })
  })

  describe('isHistoricalDate & formatDisplayDate', () => {
    it('correctly detects past dates', () => {
      expect(isHistoricalDate('2000-01-01')).toBe(true)
      expect(isHistoricalDate('2099-01-01')).toBe(false)
      expect(isHistoricalDate('invalid')).toBe(false)
    })

    it('formats dates consistently in UTC', () => {
      const formatted = formatDisplayDate('2026-06-10')
      expect(formatted).toBe('Jun 10, 2026')
      expect(formatDisplayDate('invalid')).toBe('invalid')
    })
  })
})
