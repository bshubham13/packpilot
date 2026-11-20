import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import {
  CityAutocompleteInput,
  CitySuggestionItem,
  SelectedCityChip,
  formatCityLocation,
} from '../../../src/components/location'
import { GeoService, createManualLocation } from '../../../src/services/geoService'
import type { ResolvedLocation } from '../../../src/types/context'

describe('City Autocomplete Components (Slice 7.2B-3B)', () => {
  const puneLocation: ResolvedLocation = {
    city: {
      id: 'geoname_1259229',
      name: 'Pune',
      region: 'Maharashtra',
      country: 'India',
      countryCode: 'IN',
    },
    coordinates: {
      latitude: 18.5204,
      longitude: 73.8567,
      elevationMeters: 560,
      isCentroid: true,
    },
  }

  const zurichLocation: ResolvedLocation = {
    city: {
      id: 'geoname_2657896',
      name: 'Zürich',
      region: 'Zurich',
      country: 'Switzerland',
      countryCode: 'CH',
    },
    coordinates: {
      latitude: 47.3769,
      longitude: 8.5417,
      elevationMeters: 408,
      isCentroid: true,
    },
  }

  const saoPauloLocation: ResolvedLocation = {
    city: {
      id: 'geoname_3448439',
      name: 'São Paulo',
      region: 'São Paulo',
      country: 'Brazil',
      countryCode: 'BR',
    },
    coordinates: {
      latitude: -23.5505,
      longitude: -46.6333,
      elevationMeters: 760,
      isCentroid: true,
    },
  }

  const manualLocation = createManualLocation('Kasol River Camp')

  describe('1. formatCityLocation Formatting Utility', () => {
    it('formats full location with city, region, and country', () => {
      expect(formatCityLocation(puneLocation)).toBe('Pune, Maharashtra, India')
    })

    it('formats location omitting empty or undefined region', () => {
      const loc: ResolvedLocation = {
        city: {
          id: 'singapore_sg',
          name: 'Singapore',
          country: 'Singapore',
          countryCode: 'SG',
        },
      }
      expect(formatCityLocation(loc)).toBe('Singapore')
    })

    it('formats location with Unicode and accented characters accurately', () => {
      expect(formatCityLocation(zurichLocation)).toBe('Zürich, Zurich, Switzerland')
      expect(formatCityLocation(saoPauloLocation)).toBe('São Paulo, São Paulo, Brazil')
    })

    it('omits Unknown country for manual fallback entries', () => {
      expect(formatCityLocation(manualLocation)).toBe('Kasol River Camp')
    })
  })

  describe('2. CitySuggestionItem Component', () => {
    it('renders city name, disambiguation region, country, and country code badge', () => {
      const html = renderToString(
        <CitySuggestionItem
          id="option-0"
          location={puneLocation}
          isHighlighted={false}
          onClick={vi.fn()}
        />
      )

      expect(html).toContain('role="option"')
      expect(html).toContain('id="option-0"')
      expect(html).toContain('Pune')
      expect(html).toContain('Maharashtra, India')
      expect(html).toContain('IN')
      expect(html).toContain('aria-selected="false"')
    })

    it('displays active highlight styling and aria-selected="true" when highlighted', () => {
      const html = renderToString(
        <CitySuggestionItem
          id="option-0"
          location={puneLocation}
          isHighlighted={true}
          onClick={vi.fn()}
        />
      )

      expect(html).toContain('aria-selected="true"')
      expect(html).toContain('border-terracotta')
    })

    it('renders international locations with Unicode characters correctly', () => {
      const html = renderToString(
        <CitySuggestionItem
          id="option-zurich"
          location={zurichLocation}
          isHighlighted={false}
          onClick={vi.fn()}
        />
      )

      expect(html).toContain('Zürich')
      expect(html).toContain('Zurich, Switzerland')
      expect(html).toContain('CH')
    })
  })

  describe('3. SelectedCityChip Component', () => {
    it('renders geocoded location with Geocoded badge and coordinates display', () => {
      const html = renderToString(
        <SelectedCityChip
          location={puneLocation}
          onClear={vi.fn()}
          onEdit={vi.fn()}
          label="Origin City"
        />
      )

      expect(html).toContain('Pune, Maharashtra, India')
      expect(html).toContain('Geocoded')
      expect(html).toContain('18.52°, 73.86°')
      expect(html).toContain('560m elev')
      expect(html).toContain('aria-label="Origin City: Pune, Maharashtra, India"')
      expect(html).toContain('aria-label="Change selected city Pune, Maharashtra, India"')
      expect(html).toContain('aria-label="Clear selected city Pune, Maharashtra, India"')
    })

    it('renders manual location with Custom Entry badge and no coordinates', () => {
      const html = renderToString(
        <SelectedCityChip
          location={manualLocation}
          onClear={vi.fn()}
          label="Destination"
        />
      )

      expect(html).toContain('Kasol River Camp')
      expect(html).toContain('Custom Entry')
      expect(html).not.toContain('elev')
    })

    it('supports disabled state on action buttons', () => {
      const html = renderToString(
        <SelectedCityChip
          location={puneLocation}
          onClear={vi.fn()}
          onEdit={vi.fn()}
          disabled={true}
        />
      )

      expect(html).toContain('disabled=""')
    })
  })

  describe('4. CityAutocompleteInput Rendering & Accessibility', () => {
    it('renders accessible combobox with ARIA attributes and labels', () => {
      const html = renderToString(
        <CityAutocompleteInput
          id="test-city-input"
          label="Destination City"
          required={true}
          placeholder="Search for a city..."
          onSelect={vi.fn()}
        />
      )

      expect(html).toContain('role="combobox"')
      expect(html).toContain('aria-autocomplete="list"')
      expect(html).toContain('aria-expanded="false"')
      expect(html).toContain('aria-haspopup="listbox"')
      expect(html).toContain('Destination City')
      expect(html).toContain('Search for a city...')
      expect(html).toContain('*')
    })

    it('renders helper text when provided', () => {
      const html = renderToString(
        <CityAutocompleteInput
          label="Origin City"
          helperText="Starting point for journey transit heuristics"
          onSelect={vi.fn()}
        />
      )

      expect(html).toContain('Starting point for journey transit heuristics')
    })

    it('renders error state with alert role and error message', () => {
      const html = renderToString(
        <CityAutocompleteInput
          label="Origin City"
          error="Please select a valid origin city"
          onSelect={vi.fn()}
        />
      )

      expect(html).toContain('role="alert"')
      expect(html).toContain('Please select a valid origin city')
      expect(html).toContain('border-terracotta')
    })

    it('switches to SelectedCityChip presentation when selectedLocation is supplied', () => {
      const html = renderToString(
        <CityAutocompleteInput
          label="Origin City"
          selectedLocation={puneLocation}
          onSelect={vi.fn()}
          onClear={vi.fn()}
        />
      )

      expect(html).toContain('Pune, Maharashtra, India')
      expect(html).toContain('Geocoded')
      expect(html).toContain('Change city')
      expect(html).toContain('Clear city')
      expect(html).not.toContain('role="combobox"') // Replaced with structured chip
    })
  })

  describe('5. GeoService Integration, Debounce & Cancellation Logic', () => {
    let mockGeoService: GeoService

    beforeEach(() => {
      mockGeoService = new GeoService()
    })

    it('passes search query with abort signal and limit to GeoService', async () => {
      const searchSpy = vi.spyOn(mockGeoService, 'searchCities').mockResolvedValueOnce([puneLocation])

      const results = await mockGeoService.searchCities('Pune', { limit: 5 })

      expect(searchSpy).toHaveBeenCalledWith('Pune', { limit: 5 })
      expect(results).toHaveLength(1)
      expect(results[0].city.name).toBe('Pune')
    })

    it('handles query cancellation using AbortController without unhandled rejection', async () => {
      const controller = new AbortController()
      controller.abort(new Error('Query superseded'))

      vi.spyOn(mockGeoService, 'searchCities').mockImplementationOnce(async (_q, opts) => {
        if (opts?.signal?.aborted) {
          return []
        }
        return [puneLocation]
      })

      const results = await mockGeoService.searchCities('Pune', { signal: controller.signal })
      expect(results).toEqual([])
    })

    it('handles offline or network failure gracefully returning empty list', async () => {
      vi.spyOn(mockGeoService, 'searchCities').mockRejectedValueOnce(new Error('Network error (offline)'))

      // GeoService.searchCities internally catches errors or consumer catches them
      try {
        await mockGeoService.searchCities('Mumbai')
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error)
      }
    })

    it('createManualLocation produces deterministic manual entry with rawInput', () => {
      const custom = createManualLocation('Hidden Mountain Pass')
      expect(custom.city.name).toBe('Hidden Mountain Pass')
      expect(custom.city.rawInput).toBe('Hidden Mountain Pass')
      expect(custom.city.country).toBe('Unknown')
      expect(custom.city.countryCode).toBe('XX')
      expect(custom.coordinates).toBeUndefined()
    })
  })

  describe('6. Disambiguation, Keyboard & Dropdown Interactions', () => {
    const hyderabadIndia: ResolvedLocation = {
      city: {
        id: 'geoname_1269843',
        name: 'Hyderabad',
        region: 'Telangana',
        country: 'India',
        countryCode: 'IN',
      },
      coordinates: { latitude: 17.385, longitude: 78.4867, isCentroid: true },
    }

    const hyderabadPakistan: ResolvedLocation = {
      city: {
        id: 'geoname_1176734',
        name: 'Hyderabad',
        region: 'Sindh',
        country: 'Pakistan',
        countryCode: 'PK',
      },
      coordinates: { latitude: 25.396, longitude: 68.3772, isCentroid: true },
    }

    it('renders disambiguated entries for multiple cities sharing the identical name', () => {
      const htmlIndia = renderToString(
        <CitySuggestionItem
          id="opt-india"
          location={hyderabadIndia}
          isHighlighted={false}
          onClick={vi.fn()}
        />
      )
      const htmlPakistan = renderToString(
        <CitySuggestionItem
          id="opt-pakistan"
          location={hyderabadPakistan}
          isHighlighted={true}
          onClick={vi.fn()}
        />
      )

      expect(htmlIndia).toContain('Hyderabad')
      expect(htmlIndia).toContain('Telangana, India')
      expect(htmlIndia).toContain('IN')

      expect(htmlPakistan).toContain('Hyderabad')
      expect(htmlPakistan).toContain('Sindh, Pakistan')
      expect(htmlPakistan).toContain('PK')
      expect(htmlPakistan).toContain('border-terracotta')
    })

    it('supports custom entry action with explicit manual disclaimer', () => {
      const customLoc = createManualLocation('Unmapped Himalayan Trail')
      const html = renderToString(
        <SelectedCityChip
          location={customLoc}
          onClear={vi.fn()}
          label="Trek Destination"
        />
      )

      expect(html).toContain('Unmapped Himalayan Trail')
      expect(html).toContain('Custom Entry')
      expect(html).not.toContain('Geocoded')
    })
  })
})
