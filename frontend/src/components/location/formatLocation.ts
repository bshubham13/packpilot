import type { ResolvedLocation } from '../../types/context'

/**
 * Formats a ResolvedLocation into "City, Region, Country", omitting unavailable fields cleanly.
 */
export function formatCityLocation(location: ResolvedLocation): string {
  const { city } = location
  const parts: string[] = [city.name.trim()]

  if (city.region && city.region.trim()) {
    parts.push(city.region.trim())
  }

  if (
    city.country &&
    city.country.trim() &&
    city.country !== 'Unknown' &&
    city.country !== city.name
  ) {
    parts.push(city.country.trim())
  }

  return parts.join(', ')
}
