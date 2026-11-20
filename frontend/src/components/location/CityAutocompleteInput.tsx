import React, { useState, useEffect, useRef, useId, useCallback } from 'react'
import { MapPin, Search, Loader2, PenLine, AlertCircle } from 'lucide-react'
import type { ResolvedLocation } from '../../types/context'
import { GeoService, defaultGeoService, createManualLocation } from '../../services/geoService'
import { CitySuggestionItem } from './CitySuggestionItem'
import { formatCityLocation } from './formatLocation'
import { SelectedCityChip } from './SelectedCityChip'

export interface CityAutocompleteInputProps {
  id?: string
  name?: string
  label?: string
  required?: boolean
  placeholder?: string
  value?: string
  selectedLocation?: ResolvedLocation | null
  onChange?: (text: string) => void
  onSelect: (location: ResolvedLocation) => void
  onClear?: () => void
  geoService?: GeoService
  disabled?: boolean
  error?: string | null
  helperText?: string
  className?: string
  autoFocus?: boolean
  limit?: number
  debounceMs?: number
}

/**
 * CityAutocompleteInput
 *
 * Accessible, Travel Scrapbook themed combobox input providing:
 * - 300ms debounced gazetteer lookups via GeoService
 * - Request cancellation for stale query protection
 * - Disambiguated city suggestions (City, State/Region, Country)
 * - Complete keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
 * - Explicit fallback for custom/manual entries
 * - SelectedCityChip view when a location is bound
 */
export const CityAutocompleteInput: React.FC<CityAutocompleteInputProps> = ({
  id: customId,
  name,
  label,
  required = false,
  placeholder = 'e.g. Pune, Maharashtra or Interlaken, Switzerland',
  value: controlledValue,
  selectedLocation,
  onChange,
  onSelect,
  onClear,
  geoService,
  disabled = false,
  error = null,
  helperText,
  className = '',
  autoFocus = false,
  limit = 5,
  debounceMs = 300,
}) => {
  const generatedId = useId()
  const inputId = customId || `city-input-${generatedId}`
  const listboxId = `city-listbox-${generatedId}`
  const helperId = `city-helper-${generatedId}`
  const errorId = `city-error-${generatedId}`

  // Query state
  const [inputValue, setInputValue] = useState<string>(controlledValue ?? '')
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [suggestions, setSuggestions] = useState<ResolvedLocation[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('')
  const [isEditing, setIsEditing] = useState<boolean>(!selectedLocation)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeService = geoService || defaultGeoService

  // Sync controlled value changes
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInputValue(controlledValue)
    }
  }, [controlledValue])

  // Sync selectedLocation presence
  useEffect(() => {
    if (selectedLocation) {
      setIsEditing(false)
    } else {
      setIsEditing(true)
    }
  }, [selectedLocation])

  // Cleanup pending timer and in-flight fetch on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  // Debounced search routine
  const triggerSearch = useCallback(
    (query: string) => {
      // Clear previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      // Abort previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      const trimmed = query.trim()
      if (trimmed.length < 2) {
        setSuggestions([])
        setIsOpen(false)
        setIsLoading(false)
        setHighlightedIndex(-1)
        setLiveAnnouncement('')
        return
      }

      debounceTimerRef.current = setTimeout(async () => {
        const controller = new AbortController()
        abortControllerRef.current = controller
        setIsLoading(true)

        try {
          const results = await activeService.searchCities(trimmed, {
            signal: controller.signal,
            limit,
          })

          // Drop stale results if aborted
          if (controller.signal.aborted) {
            return
          }

          setSuggestions(results)
          setIsOpen(true)
          setIsLoading(false)
          setHighlightedIndex(-1)

          if (results.length > 0) {
            setLiveAnnouncement(
              `${results.length} city suggestion${results.length === 1 ? '' : 's'} available. Use arrow keys to navigate.`
            )
          } else {
            setLiveAnnouncement(
              `No gazetteer matches found for "${trimmed}". Press enter or select custom entry below.`
            )
          }
        } catch {
          if (controller.signal.aborted) {
            return
          }
          // Network failure or offline
          setSuggestions([])
          setIsOpen(true)
          setIsLoading(false)
          setHighlightedIndex(-1)
          setLiveAnnouncement(
            `City search currently offline. Press enter to use "${trimmed}" as custom entry.`
          )
        }
      }, debounceMs)
    },
    [activeService, limit, debounceMs]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setInputValue(text)
    onChange?.(text)
    triggerSearch(text)
  }

  const handleSelectLocation = (loc: ResolvedLocation) => {
    setIsOpen(false)
    setHighlightedIndex(-1)
    setSuggestions([])
    setInputValue(formatCityLocation(loc))
    setIsEditing(false)
    setLiveAnnouncement(`Selected ${formatCityLocation(loc)}`)
    onSelect(loc)
  }

  const handleSelectCustomEntry = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    const manualLoc = createManualLocation(trimmed)
    handleSelectLocation(manualLoc)
  }

  const handleClearSelected = () => {
    setInputValue('')
    setSuggestions([])
    setIsOpen(false)
    setHighlightedIndex(-1)
    setIsEditing(true)
    onClear?.()
    onChange?.('')
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  const handleStartEditing = () => {
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  // Keyboard navigation
  const trimmedInput = inputValue.trim()
  const canShowCustomEntry = trimmedInput.length >= 2
  const totalOptions = suggestions.length + (canShowCustomEntry ? 1 : 0)
  const customEntryIndex = suggestions.length // Placed immediately after suggestions

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen && canShowCustomEntry) {
        setIsOpen(true)
        setHighlightedIndex(0)
        return
      }
      if (totalOptions > 0) {
        setHighlightedIndex((prev) => (prev + 1) % totalOptions)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (isOpen && totalOptions > 0) {
        setHighlightedIndex((prev) => (prev <= 0 ? totalOptions - 1 : prev - 1))
      }
    } else if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectLocation(suggestions[highlightedIndex])
        } else if (highlightedIndex === customEntryIndex && canShowCustomEntry) {
          handleSelectCustomEntry()
        } else if (canShowCustomEntry) {
          // If none highlighted, check if input matches top suggestion name exactly
          if (
            suggestions.length > 0 &&
            suggestions[0].city.name.toLowerCase() === trimmedInput.toLowerCase()
          ) {
            handleSelectLocation(suggestions[0])
          } else {
            handleSelectCustomEntry()
          }
        }
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
  }

  // Render selected city chip when location is confirmed and not currently in edit mode
  if (selectedLocation && !isEditing) {
    return (
      <div className={`space-y-1.5 ${className}`.trim()}>
        {label && (
          <label className="block font-sans text-xs font-semibold text-ink-black">
            {label} {required && <span className="text-terracotta">*</span>}
          </label>
        )}
        <SelectedCityChip
          location={selectedLocation}
          onClear={handleClearSelected}
          onEdit={handleStartEditing}
          disabled={disabled}
          label={label}
        />
        {helperText && !error && (
          <p className="font-sans text-xs text-ink-muted">{helperText}</p>
        )}
      </div>
    )
  }

  const activeOptionId =
    highlightedIndex >= 0
      ? highlightedIndex === customEntryIndex
        ? `${listboxId}-option-custom`
        : `${listboxId}-option-${highlightedIndex}`
      : undefined

  return (
    <div
      ref={containerRef}
      className={`relative space-y-1.5 ${className}`.trim()}
    >
      {/* Screen-reader live feedback */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {label && (
        <label
          htmlFor={inputId}
          className="block font-sans text-xs font-semibold text-ink-black"
        >
          {label} {required && <span className="text-terracotta">*</span>}
        </label>
      )}

      {/* Input container */}
      <div className="relative">
        <div
          className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-terracotta/75"
          aria-hidden="true"
        >
          <MapPin className="h-4 w-4" />
        </div>

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          required={required}
          value={inputValue}
          placeholder={placeholder}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (canShowCustomEntry && !isOpen) {
              triggerSearch(inputValue)
            }
          }}
          className={`w-full pl-9 pr-9 py-2.5 bg-warm-white border rounded-card font-sans text-sm text-ink-black placeholder:text-ink-black/40 focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent transition-all ${
            error
              ? 'border-terracotta focus:ring-terracotta'
              : 'border-sand/50 hover:border-sand'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-sand/10' : ''}`}
        />

        {/* Loading Spinner / Search Icon */}
        <div
          className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-sand"
          aria-hidden="true"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-terracotta" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
      </div>

      {/* Helper text or error */}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="font-sans text-xs text-terracotta flex items-center gap-1"
        >
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={helperId} className="font-sans text-xs text-ink-muted">
          {helperText}
        </p>
      ) : null}

      {/* Autocomplete Dropdown Listbox */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-card border border-sand/40 bg-warm-white shadow-polaroid">
          <ul
            id={listboxId}
            role="listbox"
            aria-label={label ? `${label} suggestions` : 'City suggestions'}
            className="py-1 divide-y divide-sand/20"
          >
            {/* 1. Gazetteer Suggestions */}
            {suggestions.map((loc, index) => (
              <CitySuggestionItem
                key={loc.city.id || `${loc.city.name}-${index}`}
                id={`${listboxId}-option-${index}`}
                location={loc}
                isHighlighted={highlightedIndex === index}
                onClick={() => handleSelectLocation(loc)}
                onMouseEnter={() => setHighlightedIndex(index)}
              />
            ))}

            {/* 2. Empty state prompt if 0 gazetteer results */}
            {!isLoading && suggestions.length === 0 && canShowCustomEntry && (
              <li
                className="px-3.5 py-2 text-xs font-sans text-ink-muted italic select-none"
                role="presentation"
              >
                No gazetteer matches found.
              </li>
            )}

            {/* 3. Explicit Custom Entry Option */}
            {canShowCustomEntry && (
              <li
                id={`${listboxId}-option-custom`}
                role="option"
                aria-selected={highlightedIndex === customEntryIndex}
                onClick={handleSelectCustomEntry}
                onMouseEnter={() => setHighlightedIndex(customEntryIndex)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer text-left transition-colors duration-150 select-none ${
                  highlightedIndex === customEntryIndex
                    ? 'bg-sand/25 text-ink-black border-l-3 border-terracotta pl-3'
                    : 'hover:bg-sand/15 text-ink-black/90'
                }`}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs bg-sand/20 text-ink-muted"
                  aria-hidden="true"
                >
                  <PenLine className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-xs font-medium text-ink-black truncate">
                    Use <span className="font-bold">"{trimmedInput}"</span> as custom entry
                  </p>
                  <p className="font-sans text-[11px] text-ink-muted">
                    Manual location (bypasses online coordinates)
                  </p>
                </div>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
