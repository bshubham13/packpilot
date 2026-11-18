/**
 * PackPilot — Pure Date & Duration Utilities
 * Handles UTC-safe date arithmetic, leap years, year boundaries, and input validation.
 */

const ISO_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const MS_PER_DAY = 86_400_000

/**
 * Parses an ISO 8601 date string (YYYY-MM-DD) into UTC epoch milliseconds.
 * Returns null if the format is invalid or represents an impossible calendar date (e.g. Feb 30).
 */
export function parseISODateToUTC(dateStr: string): number | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null
  }

  const trimmed = dateStr.trim()
  if (!ISO_DATE_REGEX.test(trimmed)) {
    return null
  }

  const [yearStr, monthStr, dayStr] = trimmed.split('-')
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10)
  const day = Number.parseInt(dayStr, 10)

  // Construct UTC date
  const utcDate = new Date(Date.UTC(year, month - 1, day))

  // Validate calendar round-trip (catches non-existent dates like 2026-02-29 or 2026-04-31)
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null
  }

  return utcDate.getTime()
}

/**
 * Validates whether a string is a valid ISO 8601 calendar date (YYYY-MM-DD).
 */
export function isValidDateString(dateStr: string): boolean {
  return parseISODateToUTC(dateStr) !== null
}

export interface DateRangeValidationResult {
  isValid: boolean
  error?: string
  durationDays?: number
}

/**
 * Validates a travel date range, returning detailed error reasons or the valid duration in days.
 */
export function validateDateRange(startDate: string, endDate: string): DateRangeValidationResult {
  const startUTC = parseISODateToUTC(startDate)
  if (startUTC === null) {
    return {
      isValid: false,
      error: 'Start date is missing, malformed, or an invalid calendar date (expected YYYY-MM-DD).',
    }
  }

  const endUTC = parseISODateToUTC(endDate)
  if (endUTC === null) {
    return {
      isValid: false,
      error: 'End date is missing, malformed, or an invalid calendar date (expected YYYY-MM-DD).',
    }
  }

  if (endUTC < startUTC) {
    return {
      isValid: false,
      error: 'End date cannot be earlier than start date.',
    }
  }

  // Inclusive day calculation: same day trip = 1 day
  const diffDays = Math.round((endUTC - startUTC) / MS_PER_DAY) + 1

  return {
    isValid: true,
    durationDays: diffDays,
  }
}

/**
 * Calculates travel duration in inclusive calendar days.
 * Same day trip (e.g. 2026-06-10 to 2026-06-10) = 1 day.
 * Throws an Error if dates are invalid or endDate precedes startDate.
 */
export function calculateDurationDays(startDate: string, endDate: string): number {
  const validation = validateDateRange(startDate, endDate)
  if (!validation.isValid || validation.durationDays === undefined) {
    throw new Error(validation.error || 'Invalid date range')
  }
  return validation.durationDays
}

/**
 * Checks whether an ISO date string is before today in UTC.
 */
export function isHistoricalDate(dateStr: string): boolean {
  const dateUTC = parseISODateToUTC(dateStr)
  if (dateUTC === null) return false

  const now = new Date()
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return dateUTC < todayUTC
}

/**
 * Formats an ISO date string for display (e.g. "Jun 10, 2026").
 */
export function formatDisplayDate(dateStr: string): string {
  const utc = parseISODateToUTC(dateStr)
  if (utc === null) return dateStr

  const d = new Date(utc)
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
