import { validateDateRange } from '../utils/dates'
import { getTotalTravellers, DEFAULT_BAGGAGE_CONFIG } from '../types'
import type {
  TripConfig,
  TravellerComposition,
  TransportMode,
  AccommodationType,
  BaggageConfig,
  TripActivity,
  ClimateType,
} from '../types'

export interface WizardBasicsData {
  name: string
  destination: string
  startDate: string
  endDate: string
}

export const INITIAL_BASICS: WizardBasicsData = {
  name: '',
  destination: '',
  startDate: '',
  endDate: '',
}

export const INITIAL_TRAVELLERS: TravellerComposition = {
  adults: 1,
  teens: 0,
  children: 0,
  infants: 0,
  seniors: 0,
}

export interface WizardDetailsData {
  transportModes: TransportMode[]
  accommodationType?: AccommodationType
  hasLaundryAccess: boolean
  baggageConfig: BaggageConfig
}

export const INITIAL_DETAILS: WizardDetailsData = {
  transportModes: ['flight'],
  accommodationType: 'hotel',
  hasLaundryAccess: false,
  baggageConfig: {
    ...DEFAULT_BAGGAGE_CONFIG,
  },
}

export interface WizardActivitiesData {
  activities: TripActivity[]
  climate: ClimateType
  specialRequirements: string
}

export const INITIAL_ACTIVITIES: WizardActivitiesData = {
  activities: [],
  climate: 'mixed',
  specialRequirements: '',
}

export interface WizardPreferencesData {
  personalPreferences: string[]
}

export const INITIAL_PREFERENCES: WizardPreferencesData = {
  personalPreferences: [],
}

export const SUPPORTED_PREFERENCES: {
  id: string
  label: string
  desc: string
}[] = [
  {
    id: 'medications',
    label: 'Prescription Medications & Health Note',
    desc: 'Supply reminders, doctor’s prescription note, and daily pill dispenser',
  },
  {
    id: 'work_tech',
    label: 'Remote Work Tech Kit',
    desc: 'Work laptop, power supply, multiport hub, and universal travel adapter',
  },
  {
    id: 'photography',
    label: 'Dedicated Photography Gear',
    desc: 'Camera body, primary lens, spare batteries, and memory cards',
  },
  {
    id: 'first_aid',
    label: 'Travel First-Aid & Medical Essentials',
    desc: 'Antiseptic wipes, sterile gauze, bandages, blister care, and pain relief',
  },
]

export const WIZARD_STEPS = [
  { step: 1, title: 'Basics', label: 'Trip Basics' },
  { step: 2, title: 'Travellers', label: 'Companions' },
  { step: 3, title: 'Details', label: 'Transit & Baggage' },
  { step: 4, title: 'Activities', label: 'Activities & Climate' },
  { step: 5, title: 'Review', label: 'Review & Generate' },
] as const

export function isStep1Valid(basics: WizardBasicsData): boolean {
  const trimmedName = basics.name.trim()
  const trimmedDest = basics.destination.trim()
  if (!trimmedName || trimmedName.length > 80) return false
  if (!trimmedDest) return false
  if (!basics.startDate || !basics.endDate) return false
  const validation = validateDateRange(basics.startDate, basics.endDate)
  return validation.isValid
}

export function isStep2Valid(travellers: TravellerComposition): boolean {
  const total = getTotalTravellers(travellers)
  return (
    total >= 1 &&
    total <= 20 &&
    travellers.adults >= 0 &&
    travellers.teens >= 0 &&
    travellers.children >= 0 &&
    travellers.infants >= 0 &&
    travellers.seniors >= 0
  )
}

export function isStep3Valid(details: WizardDetailsData): boolean {
  if (!details.transportModes || details.transportModes.length === 0) return false
  if (details.baggageConfig.hasCabinBaggage) {
    if (
      typeof details.baggageConfig.cabinWeightLimitKg !== 'number' ||
      !Number.isFinite(details.baggageConfig.cabinWeightLimitKg) ||
      details.baggageConfig.cabinWeightLimitKg <= 0 ||
      details.baggageConfig.cabinWeightLimitKg > 50
    ) {
      return false
    }
  }
  if (details.baggageConfig.hasCheckedBaggage) {
    if (
      typeof details.baggageConfig.checkedWeightLimitKg !== 'number' ||
      !Number.isFinite(details.baggageConfig.checkedWeightLimitKg) ||
      details.baggageConfig.checkedWeightLimitKg <= 0 ||
      details.baggageConfig.checkedWeightLimitKg > 100
    ) {
      return false
    }
  }
  return true
}

export function isStep4Valid(data: WizardActivitiesData): boolean {
  if (!data.activities || data.activities.length === 0) return false
  const validClimates: ClimateType[] = ['warm', 'cold', 'rainy', 'mixed', 'unknown']
  if (!validClimates.includes(data.climate)) return false
  if (data.specialRequirements && data.specialRequirements.length > 500) return false
  return true
}

export function isEntireWizardValid(
  basics: WizardBasicsData,
  travellers: TravellerComposition,
  details: WizardDetailsData,
  activitiesData: WizardActivitiesData
): boolean {
  return (
    isStep1Valid(basics) &&
    isStep2Valid(travellers) &&
    isStep3Valid(details) &&
    isStep4Valid(activitiesData)
  )
}

export function compileTripConfig(
  basics: WizardBasicsData,
  travellers: TravellerComposition,
  details: WizardDetailsData,
  activitiesData: WizardActivitiesData,
  preferences: WizardPreferencesData
): TripConfig {
  return {
    name: basics.name.trim(),
    destination: basics.destination.trim(),
    startDate: basics.startDate,
    endDate: basics.endDate,
    transportModes: details.transportModes,
    activities: activitiesData.activities,
    climate: activitiesData.climate,
    accommodationType: details.accommodationType,
    hasLaundryAccess: details.hasLaundryAccess,
    travellers: { ...travellers },
    personalPreferences: [...preferences.personalPreferences],
    specialRequirements: activitiesData.specialRequirements.trim() || undefined,
    baggageConfig: { ...details.baggageConfig },
  }
}

// -------------------------------------------------------------
// DRAFT RECOVERY TYPES & UTILITIES (sessionStorage)
// -------------------------------------------------------------

export const WIZARD_DRAFT_STORAGE_KEY = 'packpilot_wizard_draft'

export interface CompleteWizardDraft {
  currentStep: number
  basics: WizardBasicsData
  travellers: TravellerComposition
  details: WizardDetailsData
  activitiesData: WizardActivitiesData
  preferences: WizardPreferencesData
  savedAt: string
}

export function isValidWizardDraft(obj: unknown): obj is CompleteWizardDraft {
  if (!obj || typeof obj !== 'object') return false
  const draft = obj as Partial<CompleteWizardDraft>
  if (typeof draft.currentStep !== 'number' || draft.currentStep < 1 || draft.currentStep > 5) {
    return false
  }
  if (!draft.basics || typeof draft.basics !== 'object') return false
  if (typeof draft.basics.name !== 'string' || typeof draft.basics.destination !== 'string') {
    return false
  }
  if (!draft.travellers || typeof draft.travellers !== 'object') return false
  if (!draft.details || typeof draft.details !== 'object' || !Array.isArray(draft.details.transportModes)) {
    return false
  }
  if (!draft.activitiesData || typeof draft.activitiesData !== 'object' || !Array.isArray(draft.activitiesData.activities)) {
    return false
  }
  if (!draft.preferences || typeof draft.preferences !== 'object' || !Array.isArray(draft.preferences.personalPreferences)) {
    return false
  }
  return true
}

export function saveWizardDraft(draft: CompleteWizardDraft): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(WIZARD_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    }
  } catch {
    // Non-blocking quota or privacy mode error
  }
}

export function loadWizardDraft(): CompleteWizardDraft | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    const raw = sessionStorage.getItem(WIZARD_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (isValidWizardDraft(parsed)) {
      return parsed
    }
    // Clean up corrupt draft
    sessionStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY)
    return null
  } catch {
    return null
  }
}

export function clearWizardDraft(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY)
    }
  } catch {
    // Non-blocking
  }
}
