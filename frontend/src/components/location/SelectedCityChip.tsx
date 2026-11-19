import React from 'react'
import { MapPin, Globe, Edit2, X } from 'lucide-react'
import type { ResolvedLocation } from '../../types/context'
import { Badge } from '../ui/Badge'
import { formatCityLocation } from './formatLocation'

export interface SelectedCityChipProps {
  location: ResolvedLocation
  onClear: () => void
  onEdit?: () => void
  disabled?: boolean
  label?: string
  className?: string
}

/**
 * SelectedCityChip
 *
 * Warm paper scrapbook card presenting the chosen city, its disambiguation,
 * geocoding status (Structured vs. Custom), with explicit edit and clear actions.
 */
export const SelectedCityChip: React.FC<SelectedCityChipProps> = ({
  location,
  onClear,
  onEdit,
  disabled = false,
  label,
  className = '',
}) => {
  const formatted = formatCityLocation(location)
  const isGeocoded = Boolean(location.coordinates)

  return (
    <div
      className={`group relative flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-warm-white border border-sand/50 rounded-card shadow-xs transition-all ${className}`.trim()}
      role="group"
      aria-label={label ? `${label}: ${formatted}` : `Selected city: ${formatted}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xs ${
            isGeocoded ? 'bg-terracotta/15 text-terracotta' : 'bg-sand/20 text-ink-muted'
          }`}
          aria-hidden="true"
        >
          {isGeocoded ? (
            <MapPin className="h-4 w-4" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-sans font-semibold text-sm text-ink-black truncate">
              {formatted}
            </span>
            <Badge
              variant={isGeocoded ? 'forest' : 'sand'}
              size="sm"
            >
              {isGeocoded ? 'Geocoded' : 'Custom Entry'}
            </Badge>
          </div>

          {location.coordinates && (
            <p className="font-mono text-[11px] text-ink-muted/80 truncate">
              {`${location.coordinates.latitude.toFixed(2)}°, ${location.coordinates.longitude.toFixed(2)}°`}
              {location.coordinates.elevationMeters !== undefined &&
                ` • ${location.coordinates.elevationMeters}m elev`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            aria-label={`Change selected city ${formatted}`}
            className="flex h-7 w-7 items-center justify-center rounded-xs text-ink-muted hover:bg-sand/20 hover:text-ink-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
            title="Change city"
          >
            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label={`Clear selected city ${formatted}`}
          className="flex h-7 w-7 items-center justify-center rounded-xs text-ink-muted hover:bg-terracotta/15 hover:text-terracotta transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
          title="Clear city"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
