import React from 'react'
import { MapPin, Globe } from 'lucide-react'
import type { ResolvedLocation } from '../../types/context'

export interface CitySuggestionItemProps {
  location: ResolvedLocation
  isHighlighted: boolean
  onClick: () => void
  onMouseEnter?: () => void
  id: string
}

/**
 * CitySuggestionItem
 *
 * Travel Scrapbook themed suggestion row rendering the city name,
 * disambiguation hierarchy (state/province and country), and country code.
 */
export const CitySuggestionItem: React.FC<CitySuggestionItemProps> = ({
  location,
  isHighlighted,
  onClick,
  onMouseEnter,
  id,
}) => {
  const { city, coordinates } = location
  const disambiguationParts: string[] = []

  if (city.region && city.region.trim()) {
    disambiguationParts.push(city.region.trim())
  }
  if (city.country && city.country.trim() && city.country !== 'Unknown') {
    disambiguationParts.push(city.country.trim())
  }

  const disambiguationText = disambiguationParts.join(', ')

  return (
    <li
      id={id}
      role="option"
      aria-selected={isHighlighted}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer text-left transition-colors duration-150 select-none ${
        isHighlighted
          ? 'bg-sand/25 text-ink-black border-l-3 border-terracotta pl-3'
          : 'hover:bg-sand/15 text-ink-black/90'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <div
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xs transition-colors ${
            isHighlighted ? 'bg-terracotta/20 text-terracotta' : 'bg-sand/20 text-sand'
          }`}
          aria-hidden="true"
        >
          {coordinates ? (
            <MapPin className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Globe className="h-3.5 w-3.5 shrink-0" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-sans font-semibold text-sm text-ink-black truncate">
              {city.name}
            </span>
          </div>

          {disambiguationText && (
            <p className="font-sans text-xs text-ink-muted truncate">
              {disambiguationText}
            </p>
          )}
        </div>
      </div>

      {city.countryCode && city.countryCode !== 'XX' && (
        <span
          className="shrink-0 font-mono text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-xs bg-sand/20 text-ink-muted border border-sand/40"
          aria-label={`Country code: ${city.countryCode}`}
        >
          {city.countryCode}
        </span>
      )}
    </li>
  )
}
