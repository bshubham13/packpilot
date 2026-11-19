import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { TripWizardPage } from '../../src/pages/TripWizardPage'
import {
  isStep1Valid,
  isStep2Valid,
  isStep3Valid,
  isStep4Valid,
  isEntireWizardValid,
  compileTripConfig,
  saveWizardDraft,
  loadWizardDraft,
  clearWizardDraft,
  isValidWizardDraft,
  WIZARD_DRAFT_STORAGE_KEY,
  INITIAL_BASICS,
  INITIAL_TRAVELLERS,
  INITIAL_DETAILS,
  INITIAL_ACTIVITIES,
  type WizardBasicsData,
  type WizardDetailsData,
  type WizardActivitiesData,
  type WizardPreferencesData,
  type CompleteWizardDraft,
} from '../../src/pages/wizardValidation'
import { useTripStore } from '../../src/stores/tripStore'
import { getStorageContext, createStorageContext } from '../../src/db/factory'
import type { TravellerComposition } from '../../src/types'

// Mock Storage implementation for Node test environment
class MockStorage implements Storage {
  private store: Record<string, string> = {}
  get length() {
    return Object.keys(this.store).length
  }
  clear(): void {
    this.store = {}
  }
  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null
  }
  key(index: number): string | null {
    return Object.keys(this.store)[index] || null
  }
  removeItem(key: string): void {
    delete this.store[key]
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value)
  }
}

if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = new MockStorage()
}

describe('Trip Wizard — Complete Flow & Slices 6.3A–6.3C', () => {
  beforeEach(() => {
    createStorageContext('memory')
    sessionStorage.clear()
    useTripStore.setState({
      trips: [],
      activeTrip: null,
      isLoading: false,
      isInitialized: true,
      error: null,
      storageType: 'memory',
      isStorageAvailable: true,
    })
  })

  describe('Step 1: Basics Validation Logic', () => {
    it('returns false for initial blank basics data', () => {
      expect(isStep1Valid(INITIAL_BASICS)).toBe(false)
    })

    it('returns false when trip name is empty or pure whitespace', () => {
      const data: WizardBasicsData = {
        name: '   ',
        destination: 'Interlaken, Switzerland',
        startDate: '2026-07-10',
        endDate: '2026-07-17',
      }
      expect(isStep1Valid(data)).toBe(false)
    })

    it('returns false when trip name exceeds 80 characters', () => {
      const data: WizardBasicsData = {
        name: 'A'.repeat(81),
        destination: 'Interlaken, Switzerland',
        startDate: '2026-07-10',
        endDate: '2026-07-17',
      }
      expect(isStep1Valid(data)).toBe(false)
    })

    it('returns false when destination is empty or pure whitespace', () => {
      const data: WizardBasicsData = {
        name: 'Alpine Expedition',
        destination: '   ',
        startDate: '2026-07-10',
        endDate: '2026-07-17',
      }
      expect(isStep1Valid(data)).toBe(false)
    })

    it('returns false when dates are missing or invalid calendar dates', () => {
      expect(
        isStep1Valid({
          name: 'Alpine Expedition',
          destination: 'Interlaken',
          startDate: '',
          endDate: '2026-07-17',
        })
      ).toBe(false)

      expect(
        isStep1Valid({
          name: 'Alpine Expedition',
          destination: 'Interlaken',
          startDate: '2026-02-31', // Impossible calendar date
          endDate: '2026-03-05',
        })
      ).toBe(false)
    })

    it('returns false when end date precedes start date', () => {
      const data: WizardBasicsData = {
        name: 'Alpine Expedition',
        destination: 'Interlaken, Switzerland',
        startDate: '2026-07-17',
        endDate: '2026-07-10',
      }
      expect(isStep1Valid(data)).toBe(false)
    })

    it('returns true for a single-day trip where startDate equals endDate', () => {
      const data: WizardBasicsData = {
        name: 'Day Hike',
        destination: 'Mount Rainier',
        startDate: '2026-08-15',
        endDate: '2026-08-15',
      }
      expect(isStep1Valid(data)).toBe(true)
    })

    it('returns true for a valid multi-day trip with proper boundaries', () => {
      const data: WizardBasicsData = {
        name: 'Alpine Expedition',
        destination: 'Interlaken, Switzerland',
        startDate: '2026-07-10',
        endDate: '2026-07-17',
      }
      expect(isStep1Valid(data)).toBe(true)
    })
  })

  describe('Step 2: Travellers Validation Logic', () => {
    it('returns true for default travellers composition (1 adult)', () => {
      expect(isStep2Valid(INITIAL_TRAVELLERS)).toBe(true)
    })

    it('returns false when all traveller counts are 0', () => {
      const emptyTravellers: TravellerComposition = {
        adults: 0,
        teens: 0,
        children: 0,
        infants: 0,
        seniors: 0,
      }
      expect(isStep2Valid(emptyTravellers)).toBe(false)
    })

    it('returns false when total travellers exceeds 20', () => {
      const largeGroup: TravellerComposition = {
        adults: 15,
        teens: 5,
        children: 2,
        infants: 0,
        seniors: 0,
      }
      expect(isStep2Valid(largeGroup)).toBe(false)
    })

    it('returns true for diverse traveller party within 20 person limit', () => {
      const familyGroup: TravellerComposition = {
        adults: 2,
        teens: 1,
        children: 2,
        infants: 1,
        seniors: 2,
      }
      expect(isStep2Valid(familyGroup)).toBe(true)
    })
  })

  describe('Step 3: Travel Details Validation Logic', () => {
    it('returns true for default travel details', () => {
      expect(isStep3Valid(INITIAL_DETAILS)).toBe(true)
    })

    it('returns false when no transport modes are selected', () => {
      const noTransport: WizardDetailsData = {
        ...INITIAL_DETAILS,
        transportModes: [],
      }
      expect(isStep3Valid(noTransport)).toBe(false)
    })

    it('returns true for multiple transport modes without flight (e.g. train, car)', () => {
      const groundTransit: WizardDetailsData = {
        ...INITIAL_DETAILS,
        transportModes: ['train', 'car'],
      }
      expect(isStep3Valid(groundTransit)).toBe(true)
    })

    it('returns false when cabin baggage is enabled with 0 or negative weight', () => {
      const invalidCabinZero: WizardDetailsData = {
        ...INITIAL_DETAILS,
        baggageConfig: {
          ...INITIAL_DETAILS.baggageConfig,
          hasCabinBaggage: true,
          cabinWeightLimitKg: 0,
        },
      }
      expect(isStep3Valid(invalidCabinZero)).toBe(false)

      const invalidCabinNeg: WizardDetailsData = {
        ...INITIAL_DETAILS,
        baggageConfig: {
          ...INITIAL_DETAILS.baggageConfig,
          hasCabinBaggage: true,
          cabinWeightLimitKg: -2,
        },
      }
      expect(isStep3Valid(invalidCabinNeg)).toBe(false)
    })

    it('returns false when cabin baggage exceeds realistic limit (> 50kg)', () => {
      const extremeCabin: WizardDetailsData = {
        ...INITIAL_DETAILS,
        baggageConfig: {
          ...INITIAL_DETAILS.baggageConfig,
          hasCabinBaggage: true,
          cabinWeightLimitKg: 55,
        },
      }
      expect(isStep3Valid(extremeCabin)).toBe(false)
    })

    it('returns false when checked baggage is enabled with 0 or negative weight', () => {
      const invalidCheckedZero: WizardDetailsData = {
        ...INITIAL_DETAILS,
        baggageConfig: {
          ...INITIAL_DETAILS.baggageConfig,
          hasCheckedBaggage: true,
          checkedWeightLimitKg: 0,
        },
      }
      expect(isStep3Valid(invalidCheckedZero)).toBe(false)
    })

    it('returns false when checked baggage exceeds realistic limit (> 100kg)', () => {
      const extremeChecked: WizardDetailsData = {
        ...INITIAL_DETAILS,
        baggageConfig: {
          ...INITIAL_DETAILS.baggageConfig,
          hasCheckedBaggage: true,
          checkedWeightLimitKg: 105,
        },
      }
      expect(isStep3Valid(extremeChecked)).toBe(false)
    })

    it('allows disabled baggage even if weight limit is set to 0', () => {
      const disabledBaggage: WizardDetailsData = {
        ...INITIAL_DETAILS,
        baggageConfig: {
          hasCabinBaggage: false,
          cabinWeightLimitKg: 0,
          hasCheckedBaggage: false,
          checkedWeightLimitKg: 0,
        },
      }
      expect(isStep3Valid(disabledBaggage)).toBe(true)
    })
  })

  describe('Step 4: Activities & Climate Validation Logic', () => {
    it('returns false for initial activities data (no activity selected)', () => {
      expect(isStep4Valid(INITIAL_ACTIVITIES)).toBe(false)
    })

    it('returns true when at least one valid activity is selected', () => {
      const singleActivity: WizardActivitiesData = {
        activities: ['beach'],
        climate: 'warm',
        specialRequirements: '',
      }
      expect(isStep4Valid(singleActivity)).toBe(true)
    })

    it('returns true for multiple activities across categories', () => {
      const multiActivities: WizardActivitiesData = {
        activities: ['beach', 'sightseeing', 'trekking', 'relaxation'],
        climate: 'mixed',
        specialRequirements: 'Comfortable daypack needed for sightseeing',
      }
      expect(isStep4Valid(multiActivities)).toBe(true)
    })

    it('returns true for all approved climate types', () => {
      const climates = ['warm', 'cold', 'rainy', 'mixed', 'unknown'] as const
      for (const climate of climates) {
        expect(
          isStep4Valid({
            activities: ['sightseeing'],
            climate,
            specialRequirements: '',
          })
        ).toBe(true)
      }
    })

    it('returns false when special requirements exceed 500 characters', () => {
      const longNotes: WizardActivitiesData = {
        activities: ['sightseeing'],
        climate: 'mixed',
        specialRequirements: 'A'.repeat(501),
      }
      expect(isStep4Valid(longNotes)).toBe(false)
    })
  })

  describe('Step 5 & Entire Wizard Validation (isEntireWizardValid)', () => {
    const validBasics: WizardBasicsData = {
      name: 'Amalfi Coast Holiday',
      destination: 'Positano, Italy',
      startDate: '2026-06-10',
      endDate: '2026-06-17',
    }
    const validTravellers: TravellerComposition = {
      adults: 2,
      teens: 0,
      children: 0,
      infants: 0,
      seniors: 0,
    }
    const validDetails: WizardDetailsData = {
      transportModes: ['flight', 'train'],
      accommodationType: 'hotel',
      hasLaundryAccess: true,
      baggageConfig: {
        hasCabinBaggage: true,
        cabinWeightLimitKg: 7.0,
        hasCheckedBaggage: true,
        checkedWeightLimitKg: 23.0,
      },
    }
    const validActivities: WizardActivitiesData = {
      activities: ['beach', 'sightseeing'],
      climate: 'warm',
      specialRequirements: 'Seaside walking routes',
    }
    const validPreferences: WizardPreferencesData = {
      personalPreferences: ['medications', 'photography'],
    }

    it('returns true when all steps 1–4 are fully valid', () => {
      expect(
        isEntireWizardValid(validBasics, validTravellers, validDetails, validActivities)
      ).toBe(true)
    })

    it('returns false when any step is incomplete or invalid', () => {
      expect(
        isEntireWizardValid(INITIAL_BASICS, validTravellers, validDetails, validActivities)
      ).toBe(false)
      expect(
        isEntireWizardValid(validBasics, { adults: 0, teens: 0, children: 0, infants: 0, seniors: 0 }, validDetails, validActivities)
      ).toBe(false)
      expect(
        isEntireWizardValid(validBasics, validTravellers, { ...validDetails, transportModes: [] }, validActivities)
      ).toBe(false)
      expect(
        isEntireWizardValid(validBasics, validTravellers, validDetails, { ...validActivities, activities: [] })
      ).toBe(false)
    })

    it('compiles wizard form state into a valid TripConfig payload', () => {
      const config = compileTripConfig(
        validBasics,
        validTravellers,
        validDetails,
        validActivities,
        validPreferences
      )

      expect(config.name).toBe('Amalfi Coast Holiday')
      expect(config.destination).toBe('Positano, Italy')
      expect(config.startDate).toBe('2026-06-10')
      expect(config.endDate).toBe('2026-06-17')
      expect(config.transportModes).toEqual(['flight', 'train'])
      expect(config.activities).toEqual(['beach', 'sightseeing'])
      expect(config.climate).toBe('warm')
      expect(config.accommodationType).toBe('hotel')
      expect(config.hasLaundryAccess).toBe(true)
      expect(config.travellers.adults).toBe(2)
      expect(config.personalPreferences).toEqual(['medications', 'photography'])
      expect(config.specialRequirements).toBe('Seaside walking routes')
      expect(config.baggageConfig?.hasCabinBaggage).toBe(true)
      expect(config.baggageConfig?.cabinWeightLimitKg).toBe(7.0)
    })
  })

  describe('Draft Recovery (sessionStorage)', () => {
    const validDraft: CompleteWizardDraft = {
      currentStep: 3,
      basics: {
        name: 'Kyoto Autumn Expedition',
        destination: 'Kyoto, Japan',
        startDate: '2026-11-01',
        endDate: '2026-11-10',
      },
      travellers: {
        adults: 2,
        teens: 1,
        children: 0,
        infants: 0,
        seniors: 0,
      },
      details: INITIAL_DETAILS,
      activitiesData: {
        activities: ['sightseeing', 'relaxation'],
        climate: 'cold',
        specialRequirements: 'Temple visits requiring shoes off',
      },
      preferences: {
        personalPreferences: ['medications', 'work_tech'],
      },
      savedAt: '2026-11-01T12:00:00.000Z',
    }

    it('validates a correct draft and rejects malformed objects', () => {
      expect(isValidWizardDraft(validDraft)).toBe(true)
      expect(isValidWizardDraft(null)).toBe(false)
      expect(isValidWizardDraft({})).toBe(false)
      expect(isValidWizardDraft({ currentStep: 99 })).toBe(false)
      expect(isValidWizardDraft({ ...validDraft, basics: null as unknown as WizardBasicsData })).toBe(false)
    })

    it('saves draft to sessionStorage and loads it back cleanly', () => {
      saveWizardDraft(validDraft)
      const loaded = loadWizardDraft()

      expect(loaded).not.toBeNull()
      expect(loaded?.currentStep).toBe(3)
      expect(loaded?.basics.name).toBe('Kyoto Autumn Expedition')
      expect(loaded?.travellers.adults).toBe(2)
      expect(loaded?.activitiesData.activities).toContain('sightseeing')
      expect(loaded?.preferences.personalPreferences).toContain('work_tech')
    })

    it('handles corrupted JSON in sessionStorage safely without throwing', () => {
      sessionStorage.setItem(WIZARD_DRAFT_STORAGE_KEY, '{ invalid_json :::')
      const loaded = loadWizardDraft()
      expect(loaded).toBeNull()
    })

    it('clears draft from sessionStorage upon request', () => {
      saveWizardDraft(validDraft)
      expect(sessionStorage.getItem(WIZARD_DRAFT_STORAGE_KEY)).not.toBeNull()

      clearWizardDraft()
      expect(sessionStorage.getItem(WIZARD_DRAFT_STORAGE_KEY)).toBeNull()
      expect(loadWizardDraft()).toBeNull()
    })
  })

  describe('Recommendation Engine Integration & Storage Persistence', () => {
    it('creates trip, runs recommendation engine, and persists child items atomically', async () => {
      const storage = getStorageContext()

      const tripConfig = compileTripConfig(
        {
          name: 'Alpine Ski Trek',
          destination: 'Zermatt, Switzerland',
          startDate: '2026-12-15',
          endDate: '2026-12-22',
        },
        {
          adults: 2,
          teens: 0,
          children: 1,
          infants: 0,
          seniors: 0,
        },
        {
          transportModes: ['flight', 'train'],
          accommodationType: 'hotel',
          hasLaundryAccess: false,
          baggageConfig: {
            hasCabinBaggage: true,
            cabinWeightLimitKg: 8.0,
            hasCheckedBaggage: true,
            checkedWeightLimitKg: 23.0,
          },
        },
        {
          activities: ['trekking', 'adventure'],
          climate: 'cold',
          specialRequirements: 'Ski gear rental on site',
        },
        {
          personalPreferences: ['medications', 'photography', 'first_aid'],
        }
      )

      const createdTrip = await useTripStore.getState().createTrip(tripConfig)

      expect(createdTrip.id).toBeDefined()
      expect(createdTrip.name).toBe('Alpine Ski Trek')
      expect(createdTrip.durationDays).toBe(8)
      expect(createdTrip.totalTravellerCount).toBe(3)
      expect(createdTrip.climate).toBe('cold')

      // Verify child items were created and persisted
      const persistedItems = await storage.items.getItemsForTrip(createdTrip.id)
      expect(persistedItems.length).toBeGreaterThan(15)

      // Verify base essentials generated
      const slugs = persistedItems.map((i) => i.itemSlug)
      expect(slugs).toContain('doc-id-card')
      expect(slugs).toContain('wear-underwear')
      expect(slugs).toContain('elec-phone-charger')

      // Verify transit rules triggered
      expect(slugs).toContain('doc-boarding-pass')

      // Verify cold climate rules triggered
      expect(slugs).toContain('wear-thermal-layers')

      // Verify activity rules triggered
      expect(slugs).toContain('gear-trekking-poles')

      // Verify preference rules triggered
      expect(slugs).toContain('health-prescriptions')
      expect(slugs).toContain('elec-camera-body')
      expect(slugs).toContain('health-first-aid-kit')

      // Verify trip exists in Zustand store
      expect(useTripStore.getState().trips.length).toBe(1)
      expect(useTripStore.getState().activeTrip?.id).toBe(createdTrip.id)
    })
  })

  describe('TripWizardPage Component Rendering', () => {
    it('renders the 5-step stepper navigation header', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/wizard/new']}>
          <TripWizardPage />
        </MemoryRouter>
      )

      expect(html).toContain('Plan a New Journey')
      expect(html).toContain('Step 1 of 5')
      expect(html).toContain('Basics')
      expect(html).toContain('Travellers')
      expect(html).toContain('Details')
      expect(html).toContain('Activities')
      expect(html).toContain('Review')
    })

    it('renders Step 1 form fields with required stars and placeholder cues', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/wizard/new']}>
          <TripWizardPage />
        </MemoryRouter>
      )

      expect(html).toContain('Journey Name')
      expect(html).toContain('0/80 characters')
      expect(html).toContain('wizard-trip-name')
      expect(html).toContain('wizard-trip-destination')
      expect(html).toContain('wizard-start-date')
      expect(html).toContain('wizard-end-date')
      expect(html).toContain('Next: Travellers')
    })

    it('renders "Back to My Trips" link pointing to /trips', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/wizard/new']}>
          <TripWizardPage />
        </MemoryRouter>
      )

      expect(html).toContain('Back to My Trips')
      expect(html).toContain('href="/trips"')
    })
  })
})
