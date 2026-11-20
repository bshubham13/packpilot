import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Calendar,
  Users,
  User,
  Baby,
  Heart,
  Plus,
  Minus,
  AlertCircle,
  AlertTriangle,
  Check,
  Plane,
  Train,
  Car,
  Bike,
  Bus,
  Compass,
  Building,
  Home,
  Key,
  Tent,
  Shirt,
  Luggage,
  Waves,
  Mountain,
  Briefcase,
  Sun,
  Snowflake,
  CloudRain,
  CloudSun,
  HelpCircle,
  Edit2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { Card, Button, Badge } from '../components/ui'
import { CityAutocompleteInput, formatCityLocation } from '../components/location'
import { validateDateRange, isHistoricalDate, formatDisplayDate } from '../utils/dates'
import { getTotalTravellers } from '../types'
import type {
  TravellerComposition,
  TransportMode,
  AccommodationType,
  TripActivity,
  ClimateType,
  ResolvedLocation,
} from '../types'
import { useTripStore } from '../stores/tripStore'
import {
  INITIAL_BASICS,
  INITIAL_TRAVELLERS,
  INITIAL_DETAILS,
  INITIAL_ACTIVITIES,
  INITIAL_PREFERENCES,
  SUPPORTED_PREFERENCES,
  WIZARD_STEPS,
  isStep1Valid,
  isStep2Valid,
  isStep3Valid,
  isStep4Valid,
  isEntireWizardValid,
  isSameCityJourney,
  compileTripConfig,
  saveWizardDraft,
  loadWizardDraft,
  clearWizardDraft,
  type WizardBasicsData,
  type WizardDetailsData,
  type WizardActivitiesData,
  type WizardPreferencesData,
} from './wizardValidation'

// Transport options definition
const TRANSPORT_OPTIONS: { id: TransportMode; label: string; desc: string; icon: typeof Plane }[] = [
  { id: 'flight', label: 'Flight', desc: 'Commercial air travel', icon: Plane },
  { id: 'train', label: 'Train', desc: 'Rail & regional lines', icon: Train },
  { id: 'car', label: 'Car / Road Trip', desc: 'Automobile transit', icon: Car },
  { id: 'bike', label: 'Bike / Moto', desc: 'Bicycle or motorcycle', icon: Bike },
  { id: 'bus', label: 'Bus / Coach', desc: 'Long-distance bus', icon: Bus },
  { id: 'other', label: 'Other Transit', desc: 'Ferry, walking, etc.', icon: Compass },
]

// Accommodation options definition
const ACCOMMODATION_OPTIONS: { id: AccommodationType; label: string; desc: string; icon: typeof Building }[] = [
  { id: 'hotel', label: 'Hotel / Resort', desc: 'Housekeeping & toiletries', icon: Building },
  { id: 'hostel', label: 'Hostel', desc: 'Shared rooms & lockers', icon: Home },
  { id: 'rental', label: 'Vacation Rental', desc: 'Apartment or Airbnb', icon: Key },
  { id: 'camping', label: 'Camping', desc: 'Tent & wilderness campsite', icon: Tent },
  { id: 'friends_family', label: 'Friends & Family', desc: 'Staying with hosts', icon: Users },
]

// Activity options definition
const ACTIVITY_OPTIONS: { id: TripActivity; label: string; desc: string; icon: typeof Waves }[] = [
  { id: 'beach', label: 'Beach & Swimming', desc: 'Swimwear, quick-dry towel, UV protection', icon: Waves },
  { id: 'sightseeing', label: 'City & Sightseeing', desc: 'Walking shoes, daypack, mobile power', icon: Compass },
  { id: 'trekking', label: 'Hiking & Trekking', desc: 'Trail footwear, tech socks, poles', icon: Mountain },
  { id: 'adventure', label: 'Outdoor Adventure', desc: 'Technical shells, dry bags, safety gear', icon: Sparkles },
  { id: 'business', label: 'Business & Work', desc: 'Formal shirts, blazer, presentation gear', icon: Briefcase },
  { id: 'camping', label: 'Camping & Bushcraft', desc: 'Sleeping bag, camp stove, mess kit', icon: Tent },
  { id: 'family', label: 'Family & Kids', desc: 'Entertainment, snacks, family essentials', icon: Users },
  { id: 'relaxation', label: 'Relaxation & Spa', desc: 'Comfort loungewear, reading, wellness', icon: Sun },
]

// Climate options definition
const CLIMATE_OPTIONS: { id: ClimateType; label: string; desc: string; icon: typeof Sun }[] = [
  { id: 'warm', label: 'Warm & Tropical', desc: 'Breathable, lightweight summer attire', icon: Sun },
  { id: 'cold', label: 'Cold & Winter', desc: 'Thermal layers, fleece, insulated coat', icon: Snowflake },
  { id: 'rainy', label: 'Rainy & Wet', desc: 'Waterproof jacket, umbrella, dry bags', icon: CloudRain },
  { id: 'mixed', label: 'Mixed / Variable', desc: 'Adaptable multi-layering system', icon: CloudSun },
  { id: 'unknown', label: 'Moderate / Unknown', desc: 'Balanced baseline essentials', icon: HelpCircle },
]

export interface TripWizardPageProps {
  initialBasics?: WizardBasicsData
  initialStep?: number
  initialTravellers?: TravellerComposition
  initialDetails?: WizardDetailsData
  initialActivities?: WizardActivitiesData
  initialPreferences?: WizardPreferencesData
}

export function TripWizardPage({
  initialBasics,
  initialStep,
  initialTravellers,
  initialDetails,
  initialActivities,
  initialPreferences,
}: TripWizardPageProps = {}) {
  const navigate = useNavigate()
  const createTrip = useTripStore((state) => state.createTrip)

  const [currentStep, setCurrentStep] = useState<number>(() => initialStep ?? 1)
  const [basics, setBasics] = useState<WizardBasicsData>(() => initialBasics ?? INITIAL_BASICS)
  const [travellers, setTravellers] = useState<TravellerComposition>(() => initialTravellers ?? INITIAL_TRAVELLERS)
  const [details, setDetails] = useState<WizardDetailsData>(() => initialDetails ?? INITIAL_DETAILS)
  const [activitiesData, setActivitiesData] = useState<WizardActivitiesData>(() => initialActivities ?? INITIAL_ACTIVITIES)
  const [preferences, setPreferences] = useState<WizardPreferencesData>(() => initialPreferences ?? INITIAL_PREFERENCES)

  // Draft restoration feedback
  const [draftRestored, setDraftRestored] = useState<boolean>(false)

  // Submission & error handling state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Restore draft on mount
  useEffect(() => {
    const draft = loadWizardDraft()
    if (draft) {
      setBasics({
        ...INITIAL_BASICS,
        ...draft.basics,
        origin: draft.basics.origin ?? '',
        originLocation: draft.basics.originLocation,
        destinationLocation: draft.basics.destinationLocation,
      })
      setTravellers(draft.travellers)
      setDetails(draft.details)
      setActivitiesData(draft.activitiesData)
      setPreferences(draft.preferences)
      setCurrentStep(draft.currentStep)
      setDraftRestored(true)
    }
  }, [])

  // Autosave draft on any state changes
  useEffect(() => {
    saveWizardDraft({
      currentStep,
      basics,
      travellers,
      details,
      activitiesData,
      preferences,
      savedAt: new Date().toISOString(),
    })
  }, [currentStep, basics, travellers, details, activitiesData, preferences])

  // Step 1 Validation & Derived Values
  const step1Valid = isStep1Valid(basics)
  const isSameCity = isSameCityJourney(
    basics.origin,
    basics.destination,
    basics.originLocation,
    basics.destinationLocation
  )
  const dateValidation =
    basics.startDate && basics.endDate
      ? validateDateRange(basics.startDate, basics.endDate)
      : null
  const isHistorical = basics.startDate ? isHistoricalDate(basics.startDate) : false

  // Step 2 Validation & Derived Values
  const totalTravellers = getTotalTravellers(travellers)
  const step2Valid = isStep2Valid(travellers)

  // Step 3 Validation & Derived Values
  const step3Valid = isStep3Valid(details)
  const hasFlight = details.transportModes.includes('flight')

  // Step 4 Validation & Derived Values
  const step4Valid = isStep4Valid(activitiesData)

  // Entire Wizard Validation
  const canGenerate = isEntireWizardValid(basics, travellers, details, activitiesData)

  const handleBasicsChange = (field: keyof WizardBasicsData, value: string) => {
    setBasics((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'origin') {
        next.originLocation = undefined
      } else if (field === 'destination') {
        next.destinationLocation = undefined
      }
      return next
    })
  }

  const handleOriginChange = (text: string) => {
    setBasics((prev) => ({
      ...prev,
      origin: text,
      originLocation: undefined,
    }))
  }

  const handleOriginSelect = (loc: ResolvedLocation) => {
    setBasics((prev) => ({
      ...prev,
      origin: formatCityLocation(loc),
      originLocation: loc,
    }))
  }

  const handleOriginClear = () => {
    setBasics((prev) => ({
      ...prev,
      origin: '',
      originLocation: undefined,
    }))
  }

  const handleDestinationChange = (text: string) => {
    setBasics((prev) => ({
      ...prev,
      destination: text,
      destinationLocation: undefined,
    }))
  }

  const handleDestinationSelect = (loc: ResolvedLocation) => {
    setBasics((prev) => ({
      ...prev,
      destination: formatCityLocation(loc),
      destinationLocation: loc,
    }))
  }

  const handleDestinationClear = () => {
    setBasics((prev) => ({
      ...prev,
      destination: '',
      destinationLocation: undefined,
    }))
  }

  const handleTravellerChange = (group: keyof TravellerComposition, delta: number) => {
    setTravellers((prev) => {
      const current = prev[group]
      const next = Math.max(0, Math.min(20, current + delta))
      const newTotal = totalTravellers - current + next
      if (newTotal > 20) return prev
      return { ...prev, [group]: next }
    })
  }

  const toggleTransportMode = (mode: TransportMode) => {
    setDetails((prev) => {
      const exists = prev.transportModes.includes(mode)
      const next = exists
        ? prev.transportModes.filter((m) => m !== mode)
        : [...prev.transportModes, mode]
      return { ...prev, transportModes: next }
    })
  }

  const selectAccommodation = (type: AccommodationType) => {
    setDetails((prev) => ({
      ...prev,
      accommodationType: prev.accommodationType === type ? undefined : type,
    }))
  }

  const toggleLaundryAccess = () => {
    setDetails((prev) => ({ ...prev, hasLaundryAccess: !prev.hasLaundryAccess }))
  }

  const toggleCabinBaggage = () => {
    setDetails((prev) => ({
      ...prev,
      baggageConfig: {
        ...prev.baggageConfig,
        hasCabinBaggage: !prev.baggageConfig.hasCabinBaggage,
      },
    }))
  }

  const setCabinWeight = (weight: number) => {
    setDetails((prev) => ({
      ...prev,
      baggageConfig: {
        ...prev.baggageConfig,
        cabinWeightLimitKg: weight,
      },
    }))
  }

  const toggleCheckedBaggage = () => {
    setDetails((prev) => ({
      ...prev,
      baggageConfig: {
        ...prev.baggageConfig,
        hasCheckedBaggage: !prev.baggageConfig.hasCheckedBaggage,
      },
    }))
  }

  const setCheckedWeight = (weight: number) => {
    setDetails((prev) => ({
      ...prev,
      baggageConfig: {
        ...prev.baggageConfig,
        checkedWeightLimitKg: weight,
      },
    }))
  }

  const toggleActivity = (activity: TripActivity) => {
    setActivitiesData((prev) => {
      const exists = prev.activities.includes(activity)
      const next = exists
        ? prev.activities.filter((a) => a !== activity)
        : [...prev.activities, activity]
      return { ...prev, activities: next }
    })
  }

  const selectClimate = (climate: ClimateType) => {
    setActivitiesData((prev) => ({ ...prev, climate }))
  }

  const handleNotesChange = (specialRequirements: string) => {
    if (specialRequirements.length <= 500) {
      setActivitiesData((prev) => ({ ...prev, specialRequirements }))
    }
  }

  const togglePreference = (prefId: string) => {
    setPreferences((prev) => {
      const exists = prev.personalPreferences.includes(prefId)
      const next = exists
        ? prev.personalPreferences.filter((p) => p !== prefId)
        : [...prev.personalPreferences, prefId]
      return { ...prev, personalPreferences: next }
    })
  }

  const handleClearDraft = () => {
    clearWizardDraft()
    setBasics(INITIAL_BASICS)
    setTravellers(INITIAL_TRAVELLERS)
    setDetails(INITIAL_DETAILS)
    setActivitiesData(INITIAL_ACTIVITIES)
    setPreferences(INITIAL_PREFERENCES)
    setCurrentStep(1)
    setDraftRestored(false)
  }

  // Step 5: Final Compilation & Checklist Generation
  const handleGenerateChecklist = async () => {
    if (isSubmitting || !canGenerate) return
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const tripConfig = compileTripConfig(
        basics,
        travellers,
        details,
        activitiesData,
        preferences
      )
      const createdTrip = await createTrip(tripConfig)
      clearWizardDraft()
      navigate(`/trips/${createdTrip.id}`)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to create trip and generate packing checklist. Please verify your inputs and retry.'
      setSubmitError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 pb-12">
      {/* Top Editorial Breadcrumb & Header */}
      <div className="space-y-2 border-b border-sand/40 pb-4">
        <Link
          to="/trips"
          className="inline-flex items-center gap-1.5 text-xs font-sans text-ink-black/60 hover:text-terracotta transition-colors mb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta rounded-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to My Trips</span>
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="terracotta" size="sm" icon={<Sparkles className="w-3 h-3" />}>
                Trip Wizard
              </Badge>
              <Badge variant="outline" size="sm">
                {`Step ${currentStep} of 5`}
              </Badge>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink-black">
              Plan a New Journey
            </h1>
            <p className="font-sans text-xs sm:text-sm text-ink-black/70 mt-0.5 leading-normal sm:leading-relaxed">
              Answer a few questions to generate your tailored, intelligent packing checklist.
            </p>
          </div>
        </div>
      </div>

      {/* Draft Restored Banner */}
      {draftRestored && (
        <div
          role="status"
          className="bg-sand/20 border border-sand/40 rounded-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-sans text-ink-black/80"
        >
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-terracotta shrink-0" aria-hidden="true" />
            <span>
              Restored an in-progress journey draft from your current session.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClearDraft}
              className="font-medium text-terracotta hover:underline cursor-pointer"
            >
              Discard draft
            </button>
            <span className="text-sand">&bull;</span>
            <button
              type="button"
              onClick={() => setDraftRestored(false)}
              className="text-ink-black/60 hover:text-ink-black cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 5-Step Visual Stepper Progress Bar */}
      <nav aria-label="Trip wizard steps" className="py-1">
        <ol className="flex items-center justify-between gap-1 sm:gap-2">
          {WIZARD_STEPS.map((stepItem) => {
            const isCompleted = stepItem.step < currentStep
            const isActive = stepItem.step === currentStep
            const canNavigateBack = isCompleted

            return (
              <li key={stepItem.step} className="flex-1 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => canNavigateBack && setCurrentStep(stepItem.step)}
                  disabled={!canNavigateBack}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${stepItem.step}: ${stepItem.label}${
                    isCompleted ? ' (Completed - click to return)' : isActive ? ' (Current Step)' : ''
                  }`}
                  className={`w-full group flex flex-col items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta rounded-card p-1 ${
                    canNavigateBack ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-sans text-xs font-bold transition-all border ${
                      isCompleted
                        ? 'bg-forest-green text-warm-white border-forest-green shadow-xs'
                        : isActive
                        ? 'bg-terracotta text-warm-white border-terracotta shadow-xs'
                        : 'bg-warm-white text-ink-black/40 border-sand/40'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                    ) : (
                      stepItem.step
                    )}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-sans text-center truncate max-w-full leading-tight ${
                      isActive
                        ? 'font-bold text-terracotta'
                        : isCompleted
                        ? 'font-medium text-ink-black'
                        : 'text-ink-black/40'
                    }`}
                  >
                    {stepItem.title}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* STEP 1: TRIP BASICS */}
      {currentStep === 1 && (
        <Card variant="scrapbook" hasTape className="p-5 sm:p-7 space-y-5">
          <div className="border-b border-sand/30 pb-3">
            <h2 className="font-serif font-bold text-lg sm:text-xl text-ink-black">
              1. Journey Fundamentals
            </h2>
            <p className="font-sans text-xs sm:text-sm text-ink-black/70 mt-0.5">
              Name your expedition and specify your travel dates to scale packing quantities.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (step1Valid) setCurrentStep(2)
            }}
            className="space-y-4 sm:space-y-5"
          >
            {/* Trip Name Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="wizard-trip-name"
                  className="font-sans font-semibold text-ink-black"
                >
                  Journey Name <span className="text-terracotta">*</span>
                </label>
                <span className="text-ink-black/50 text-[11px]">
                  {`${basics.name.length}/80 characters`}
                </span>
              </div>
              <input
                id="wizard-trip-name"
                type="text"
                maxLength={80}
                required
                value={basics.name}
                onChange={(e) => handleBasicsChange('name', e.target.value)}
                placeholder="e.g. Alpine Summer Trek, Amalfi Coast Holiday"
                className="w-full px-3.5 py-2.5 bg-warm-white border border-sand/50 rounded-card font-sans text-sm text-ink-black placeholder:text-ink-black/40 focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent transition-all"
              />
            </div>

            {/* Origin & Destination Location Inputs */}
            <div className="space-y-4">
              {/* Origin City Field */}
              <CityAutocompleteInput
                id="wizard-trip-origin"
                name="wizard-trip-origin"
                label="Starting Point / Origin City"
                required
                placeholder="e.g. Mumbai, Maharashtra or London, UK"
                value={basics.origin || ''}
                selectedLocation={basics.originLocation || null}
                onChange={handleOriginChange}
                onSelect={handleOriginSelect}
                onClear={handleOriginClear}
                helperText="Departure city used for journey distance and environmental comparison."
              />

              {/* Destination City Field */}
              <CityAutocompleteInput
                id="wizard-trip-destination"
                name="wizard-trip-destination"
                label="Destination City"
                required
                placeholder="e.g. Interlaken, Switzerland or Kyoto, Japan"
                value={basics.destination || ''}
                selectedLocation={basics.destinationLocation || null}
                onChange={handleDestinationChange}
                onSelect={handleDestinationSelect}
                onClear={handleDestinationClear}
                helperText="Primary destination for weather forecasts, air quality, and packing needs."
              />

              {/* Same-City Informational Notice */}
              {isSameCity && (
                <div
                  role="status"
                  className="p-3 bg-sand/20 border border-sand/40 rounded-card flex items-start gap-2.5 text-xs font-sans text-ink-black/80"
                >
                  <Compass className="w-4 h-4 text-forest-green shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-ink-black">Local Journey / Staycation</span>
                    <p className="text-ink-black/70">
                      Origin and destination are in the same city. PackPilot will optimize your packing list for local activities and conditions without intercity transit overhead.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Travel Dates Grid */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="wizard-start-date"
                    className="block font-sans text-xs font-semibold text-ink-black"
                  >
                    Start Date <span className="text-terracotta">*</span>
                  </label>
                  <input
                    id="wizard-start-date"
                    type="date"
                    required
                    value={basics.startDate}
                    onChange={(e) => handleBasicsChange('startDate', e.target.value)}
                    className="w-full px-3.5 py-2 bg-warm-white border border-sand/50 rounded-card font-sans text-sm text-ink-black focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent transition-all"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="wizard-end-date"
                    className="block font-sans text-xs font-semibold text-ink-black"
                  >
                    End Date <span className="text-terracotta">*</span>
                  </label>
                  <input
                    id="wizard-end-date"
                    type="date"
                    required
                    value={basics.endDate}
                    onChange={(e) => handleBasicsChange('endDate', e.target.value)}
                    className="w-full px-3.5 py-2 bg-warm-white border border-sand/50 rounded-card font-sans text-sm text-ink-black focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Date Validation Feedback / Inclusive Duration Readout */}
              {dateValidation && (
                <div className="pt-1 space-y-1.5">
                  {dateValidation.isValid ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="sand" size="sm" icon={<Calendar className="w-3.5 h-3.5" />}>
                        {`${dateValidation.durationDays} ${
                          dateValidation.durationDays === 1 ? 'Day' : 'Days'
                        } (inclusive travel duration)`}
                      </Badge>

                      {isHistorical && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-sans text-sand-700 bg-sand/20 px-2 py-0.5 rounded-full border border-sand/40">
                          <AlertCircle className="w-3 h-3 text-sand-700 shrink-0" aria-hidden="true" />
                          <span>Historical journey log (past start date)</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      role="alert"
                      className="flex items-center gap-1.5 text-xs font-sans text-terracotta font-medium bg-terracotta/10 px-3 py-1.5 rounded-card border border-terracotta/30"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{dateValidation.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 1 Actions */}
            <div className="pt-4 border-t border-sand/30 flex items-center justify-between gap-3">
              <Link to="/trips">
                <Button variant="ghost" size="sm" type="button">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={!step1Valid}
                rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                Next: Travellers
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 2: TRAVELLERS */}
      {currentStep === 2 && (
        <Card variant="scrapbook" hasTape className="p-5 sm:p-7 space-y-5">
          <div className="border-b border-sand/30 pb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="font-serif font-bold text-lg sm:text-xl text-ink-black">
                2. Travel Companions
              </h2>
              <p className="font-sans text-xs sm:text-sm text-ink-black/70 mt-0.5">
                Specify your travel party so PackPilot can scale individual clothing and shared gear.
              </p>
            </div>
            <Badge variant="sand" size="sm" icon={<Users className="w-3.5 h-3.5" />}>
              {`${totalTravellers} ${totalTravellers === 1 ? 'Person' : 'People'}`}
            </Badge>
          </div>

          <div className="space-y-3.5">
            {/* Adults */}
            <div className="p-3.5 bg-warm-white/80 rounded-card border border-sand/40 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sand/20 text-ink-black flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-ink-black leading-tight">
                    Adults
                  </h3>
                  <p className="font-sans text-[11px] text-ink-black/60">Ages 18–64</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTravellerChange('adults', -1)}
                  disabled={travellers.adults <= 0}
                  aria-label="Decrease adult travellers"
                  className="w-8 h-8 rounded-card border border-sand/60 bg-warm-white hover:bg-sand/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-ink-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  aria-label={`${travellers.adults} Adults`}
                  className="w-7 text-center font-sans font-bold text-sm text-ink-black"
                >
                  {travellers.adults}
                </span>
                <button
                  type="button"
                  onClick={() => handleTravellerChange('adults', 1)}
                  disabled={totalTravellers >= 20}
                  aria-label="Increase adult travellers"
                  className="w-8 h-8 rounded-card border border-sand/60 bg-warm-white hover:bg-sand/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-ink-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Teens */}
            <div className="p-3.5 bg-warm-white/80 rounded-card border border-sand/40 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sand/20 text-ink-black flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-ink-black leading-tight">
                    Teens
                  </h3>
                  <p className="font-sans text-[11px] text-ink-black/60">Ages 13–17</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTravellerChange('teens', -1)}
                  disabled={travellers.teens <= 0}
                  aria-label="Decrease teen travellers"
                  className="w-8 h-8 rounded-card border border-sand/60 bg-warm-white hover:bg-sand/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-ink-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  aria-label={`${travellers.teens} Teens`}
                  className="w-7 text-center font-sans font-bold text-sm text-ink-black"
                >
                  {travellers.teens}
                </span>
                <button
                  type="button"
                  onClick={() => handleTravellerChange('teens', 1)}
                  disabled={totalTravellers >= 20}
                  aria-label="Increase teen travellers"
                  className="w-8 h-8 rounded-card border border-sand/60 bg-warm-white hover:bg-sand/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-ink-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Children */}
            <div className="p-3.5 bg-warm-white/80 rounded-card border border-sand/40 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sand/20 text-ink-black flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-ink-black leading-tight">
                    Children
                  </h3>
                  <p className="font-sans text-[11px] text-ink-black/60">Ages 3–12 (requires kid entertainment &amp; clothing)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTravellerChange('children', -1)}
                  disabled={travellers.children <= 0}
                  aria-label="Decrease child travellers"
                  className="w-8 h-8 rounded-card border border-sand/60 bg-warm-white hover:bg-sand/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-ink-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  aria-label={`${travellers.children} Children`}
                  className="w-7 text-center font-sans font-bold text-sm text-ink-black"
                >
                  {travellers.children}
                </span>
                <button
                  type="button"
                  onClick={() => handleTravellerChange('children', 1)}
                  disabled={totalTravellers >= 20}
                  aria-label="Increase child travellers"
                  className="w-8 h-8 rounded-card border border-sand/60 bg-warm-white hover:bg-sand/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-ink-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Infants */}
            <div className="p-3.5 bg-warm-white/80 rounded-card border border-sand/40 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sand/20 text-ink-black flex items-center justify-center shrink-0">
                  <Baby className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-ink-black leading-tight">
                    Infants
                  </h3>
                  <p className="font-sans text-[11px] text-ink-black/60">Ages 0–2 (triggers diapers, formula &amp; baby care rules)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTravellerChange('infants', -1)}
                  disabled={travellers.infants <= 0}
                  aria-label="Decrease infant travellers"
                  className="w-8 h-8 rounded-card border border-sand/60 bg-warm-white hover:bg-sand/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-ink-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  aria-label={`${travellers.infants} Infants`}
                  className="w-7 text-center font-sans font-bold text-sm text-ink-black"
                >
                  {travellers.infants}
                </span>
                <button
                  type="button"
                  onClick={() => handleTravellerChange('infants', 1)}
                  disabled={totalTravellers >= 20}
                  aria-label="Increase infant travellers"
                  className="w-8 h-8 rounded-card border border-sand/60 bg-warm-white hover:bg-sand/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-ink-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Seniors */}
            <div className="p-3.5 bg-warm-white/80 rounded-card border border-sand/40 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sand/20 text-ink-black flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-ink-black leading-tight">
                    Seniors
                  </h3>
                  <p className="font-sans text-[11px] text-ink-black/60">Ages 65+ (comfort essentials &amp; travel pacing)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTravellerChange('seniors', -1)}
                  disabled={travellers.seniors <= 0}
                  aria-label="Decrease senior travellers"
                  className="w-8 h-8 rounded-card border border-sand/60 bg-warm-white hover:bg-sand/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-ink-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  aria-label={`${travellers.seniors} Seniors`}
                  className="w-7 text-center font-sans font-bold text-sm text-ink-black"
                >
                  {travellers.seniors}
                </span>
                <button
                  type="button"
                  onClick={() => handleTravellerChange('seniors', 1)}
                  disabled={totalTravellers >= 20}
                  aria-label="Increase senior travellers"
                  className="w-8 h-8 rounded-card border border-sand/60 bg-warm-white hover:bg-sand/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-ink-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Validation Notice if total < 1 */}
            {totalTravellers < 1 && (
              <div
                role="alert"
                className="flex items-center gap-1.5 text-xs font-sans text-terracotta font-medium bg-terracotta/10 px-3 py-1.5 rounded-card border border-terracotta/30"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>At least one traveller is required to plan an itinerary.</span>
              </div>
            )}
          </div>

          {/* Step 2 Actions */}
          <div className="pt-4 border-t border-sand/30 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setCurrentStep(1)}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Previous: Basics
            </Button>
            <Button
              variant="primary"
              size="md"
              type="button"
              disabled={!step2Valid}
              onClick={() => setCurrentStep(3)}
              rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              Next: Travel Details
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: TRAVEL DETAILS */}
      {currentStep === 3 && (
        <Card variant="scrapbook" hasTape className="p-5 sm:p-7 space-y-6">
          <div className="border-b border-sand/30 pb-3">
            <h2 className="font-serif font-bold text-lg sm:text-xl text-ink-black">
              3. Transit, Lodging &amp; Baggage
            </h2>
            <p className="font-sans text-xs sm:text-sm text-ink-black/70 mt-0.5">
              Specify your transit modes, accommodations, and luggage boundaries to ensure weight limits and packing rules are met.
            </p>
          </div>

          <div className="space-y-6">
            {/* Transport Modes Selection */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block font-sans text-xs font-semibold text-ink-black">
                  Transport Modes <span className="text-terracotta">*</span>
                </label>
                <span className="text-[11px] text-ink-black/60 font-sans">
                  Select at least one
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {TRANSPORT_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = details.transportModes.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleTransportMode(opt.id)}
                      aria-pressed={isSelected}
                      className={`p-3 rounded-card border text-left transition-all flex flex-col gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer ${
                        isSelected
                          ? 'border-terracotta bg-terracotta/10 text-terracotta shadow-xs'
                          : 'border-sand/50 bg-warm-white/80 hover:bg-sand/15 text-ink-black'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {isSelected && <Check className="w-3.5 h-3.5 text-terracotta stroke-[2.5]" />}
                      </div>
                      <div>
                        <span className="font-serif font-bold text-xs sm:text-sm block leading-snug">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-ink-black/60 font-sans block leading-tight mt-0.5">
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
              {details.transportModes.length === 0 && (
                <p role="alert" className="text-xs text-terracotta font-medium flex items-center gap-1 pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  Please select at least one transport mode.
                </p>
              )}
            </div>

            {/* Accommodation Selection (Optional) */}
            <div className="space-y-2.5 pt-2 border-t border-sand/20">
              <div className="flex items-center justify-between">
                <label className="block font-sans text-xs font-semibold text-ink-black">
                  Accommodation Type <span className="font-normal text-ink-black/60">(Optional)</span>
                </label>
                {details.accommodationType && (
                  <button
                    type="button"
                    onClick={() => setDetails((prev) => ({ ...prev, accommodationType: undefined }))}
                    className="text-[11px] text-terracotta hover:underline font-sans cursor-pointer"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ACCOMMODATION_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = details.accommodationType === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectAccommodation(opt.id)}
                      aria-pressed={isSelected}
                      className={`p-3 rounded-card border text-left transition-all flex flex-col gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer ${
                        isSelected
                          ? 'border-terracotta bg-terracotta/10 text-terracotta shadow-xs'
                          : 'border-sand/50 bg-warm-white/80 hover:bg-sand/15 text-ink-black'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {isSelected && <Check className="w-3.5 h-3.5 text-terracotta stroke-[2.5]" />}
                      </div>
                      <div>
                        <span className="font-serif font-bold text-xs sm:text-sm block leading-snug">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-ink-black/60 font-sans block leading-tight mt-0.5">
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Laundry Facility Access Toggle */}
            <div className="p-4 bg-warm-white rounded-card border border-sand/40 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={details.hasLaundryAccess}
                  onChange={toggleLaundryAccess}
                  className="mt-0.5 h-4 w-4 rounded-sm border-sand/60 text-terracotta focus:ring-terracotta accent-terracotta cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-serif font-bold text-xs sm:text-sm text-ink-black">
                    <Shirt className="w-3.5 h-3.5 text-terracotta shrink-0" aria-hidden="true" />
                    <span>Guaranteed Laundry Facility Access</span>
                  </div>
                  <p className="font-sans text-[11px] sm:text-xs text-ink-black/70 leading-normal">
                    Check this if you will have reliable access to a washing machine during your journey.
                    Enabling laundry access caps clothing quantities at 7–10 days rather than packing full separate sets for every day.
                  </p>
                  <p className="font-sans text-[10px] text-ink-black/50 italic">
                    Note: Accommodation selection does not automatically assume laundry availability.
                  </p>
                </div>
              </label>
            </div>

            {/* Dual Baggage Configuration */}
            <div className="space-y-4 pt-2 border-t border-sand/20">
              <div>
                <div className="flex items-center gap-2">
                  <Luggage className="w-4 h-4 text-terracotta" aria-hidden="true" />
                  <h3 className="font-serif font-bold text-sm sm:text-base text-ink-black">
                    Luggage &amp; Weight Limits
                  </h3>
                </div>
                {!hasFlight && (
                  <p className="font-sans text-[11px] text-ink-black/60 mt-1">
                    Airline limits are typical for flights. For overland travel, you may disable or adjust these as preferred.
                  </p>
                )}
              </div>

              {/* Cabin Baggage Card */}
              <div className="p-4 bg-warm-white/90 rounded-card border border-sand/40 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-serif font-bold text-xs sm:text-sm text-ink-black">
                    <input
                      type="checkbox"
                      checked={details.baggageConfig.hasCabinBaggage}
                      onChange={toggleCabinBaggage}
                      className="h-4 w-4 rounded-sm border-sand/60 text-terracotta focus:ring-terracotta accent-terracotta cursor-pointer"
                    />
                    <span>Cabin / Carry-On Baggage</span>
                  </label>
                  <Badge variant={details.baggageConfig.hasCabinBaggage ? 'terracotta' : 'sand'} size="sm">
                    {details.baggageConfig.hasCabinBaggage ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                {details.baggageConfig.hasCabinBaggage && (
                  <div className="space-y-2 pt-2 border-t border-sand/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label htmlFor="cabin-weight-input" className="text-xs font-sans text-ink-black/75">
                        Weight Limit (kg):
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-ink-black/50 font-sans mr-1">Presets:</span>
                        {[7.0, 8.0, 10.0].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setCabinWeight(preset)}
                            className={`text-xs px-2.5 py-1 rounded-card border font-sans font-medium transition-all cursor-pointer ${
                              details.baggageConfig.cabinWeightLimitKg === preset
                                ? 'bg-terracotta text-warm-white border-terracotta'
                                : 'bg-warm-white text-ink-black border-sand/50 hover:bg-sand/15'
                            }`}
                          >
                            {preset} kg
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 max-w-[160px]">
                      <input
                        id="cabin-weight-input"
                        type="number"
                        min="1"
                        max="50"
                        step="0.5"
                        value={details.baggageConfig.cabinWeightLimitKg}
                        onChange={(e) => setCabinWeight(Number.parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-warm-white border border-sand/50 rounded-card font-sans text-xs text-ink-black focus:outline-none focus:ring-2 focus:ring-terracotta"
                      />
                      <span className="text-xs font-sans text-ink-black/60">kg</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Checked Baggage Card */}
              <div className="p-4 bg-warm-white/90 rounded-card border border-sand/40 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-serif font-bold text-xs sm:text-sm text-ink-black">
                    <input
                      type="checkbox"
                      checked={details.baggageConfig.hasCheckedBaggage}
                      onChange={toggleCheckedBaggage}
                      className="h-4 w-4 rounded-sm border-sand/60 text-terracotta focus:ring-terracotta accent-terracotta cursor-pointer"
                    />
                    <span>Checked Baggage (Hold Luggage)</span>
                  </label>
                  <Badge variant={details.baggageConfig.hasCheckedBaggage ? 'terracotta' : 'sand'} size="sm">
                    {details.baggageConfig.hasCheckedBaggage ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                {details.baggageConfig.hasCheckedBaggage && (
                  <div className="space-y-2 pt-2 border-t border-sand/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label htmlFor="checked-weight-input" className="text-xs font-sans text-ink-black/75">
                        Weight Limit (kg):
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-ink-black/50 font-sans mr-1">Presets:</span>
                        {[20.0, 23.0, 32.0].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setCheckedWeight(preset)}
                            className={`text-xs px-2.5 py-1 rounded-card border font-sans font-medium transition-all cursor-pointer ${
                              details.baggageConfig.checkedWeightLimitKg === preset
                                ? 'bg-terracotta text-warm-white border-terracotta'
                                : 'bg-warm-white text-ink-black border-sand/50 hover:bg-sand/15'
                            }`}
                          >
                            {preset} kg
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 max-w-[160px]">
                      <input
                        id="checked-weight-input"
                        type="number"
                        min="1"
                        max="100"
                        step="0.5"
                        value={details.baggageConfig.checkedWeightLimitKg}
                        onChange={(e) => setCheckedWeight(Number.parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-warm-white border border-sand/50 rounded-card font-sans text-xs text-ink-black focus:outline-none focus:ring-2 focus:ring-terracotta"
                      />
                      <span className="text-xs font-sans text-ink-black/60">kg</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3 Actions */}
          <div className="pt-4 border-t border-sand/30 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setCurrentStep(2)}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Previous: Travellers
            </Button>
            <Button
              variant="primary"
              size="md"
              type="button"
              disabled={!step3Valid}
              onClick={() => setCurrentStep(4)}
              rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              Next: Activities &amp; Climate
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4: ACTIVITIES & CLIMATE */}
      {currentStep === 4 && (
        <Card variant="scrapbook" hasTape className="p-5 sm:p-7 space-y-6">
          <div className="border-b border-sand/30 pb-3">
            <h2 className="font-serif font-bold text-lg sm:text-xl text-ink-black">
              4. Activities &amp; Expected Climate
            </h2>
            <p className="font-sans text-xs sm:text-sm text-ink-black/70 mt-0.5">
              Select your planned pursuits and weather forecast to trigger specialized equipment and climate-rated layers.
            </p>
          </div>

          <div className="space-y-6">
            {/* Activities Multi-Select */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block font-sans text-xs font-semibold text-ink-black">
                  Planned Activities <span className="text-terracotta">*</span>
                </label>
                <Badge variant={activitiesData.activities.length > 0 ? 'sand' : 'outline'} size="sm">
                  {`${activitiesData.activities.length} Selected`}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {ACTIVITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = activitiesData.activities.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleActivity(opt.id)}
                      aria-pressed={isSelected}
                      className={`p-3 rounded-card border text-left transition-all flex flex-col justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer min-h-[96px] ${
                        isSelected
                          ? 'border-terracotta bg-terracotta/10 text-terracotta shadow-xs'
                          : 'border-sand/50 bg-warm-white/80 hover:bg-sand/15 text-ink-black'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {isSelected && <Check className="w-3.5 h-3.5 text-terracotta stroke-[2.5]" />}
                      </div>
                      <div>
                        <span className="font-serif font-bold text-xs sm:text-sm block leading-snug">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-ink-black/60 font-sans block leading-tight mt-0.5 line-clamp-2">
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
              {activitiesData.activities.length === 0 && (
                <p role="alert" className="text-xs text-terracotta font-medium flex items-center gap-1 pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  Please select at least one activity.
                </p>
              )}
            </div>

            {/* Expected Climate Single-Select */}
            <div className="space-y-2.5 pt-2 border-t border-sand/20">
              <label className="block font-sans text-xs font-semibold text-ink-black">
                Expected Weather &amp; Climate <span className="text-terracotta">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {CLIMATE_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = activitiesData.climate === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectClimate(opt.id)}
                      aria-pressed={isSelected}
                      className={`p-3 rounded-card border text-left transition-all flex items-start gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer ${
                        isSelected
                          ? 'border-terracotta bg-terracotta/10 text-terracotta shadow-xs'
                          : 'border-sand/50 bg-warm-white/80 hover:bg-sand/15 text-ink-black'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-sand/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-ink-black" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-serif font-bold text-xs sm:text-sm block leading-tight">
                            {opt.label}
                          </span>
                          {isSelected && <Check className="w-3 h-3 text-terracotta stroke-[2.5]" />}
                        </div>
                        <span className="text-[10px] text-ink-black/60 font-sans block leading-tight mt-0.5">
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Special Requirements Textarea */}
            <div className="space-y-1.5 pt-2 border-t border-sand/20">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="wizard-special-requirements" className="font-sans font-semibold text-ink-black">
                  Special Requirements or Notes <span className="font-normal text-ink-black/60">(Optional)</span>
                </label>
                <span className="text-[11px] text-ink-black/50">
                  {`${activitiesData.specialRequirements.length}/500`}
                </span>
              </div>
              <textarea
                id="wizard-special-requirements"
                rows={3}
                maxLength={500}
                value={activitiesData.specialRequirements}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="e.g. Planning to visit temples requiring shoulder coverage, special dietary provisions, or extreme elevation gear..."
                className="w-full px-3.5 py-2.5 bg-warm-white border border-sand/50 rounded-card font-sans text-xs sm:text-sm text-ink-black placeholder:text-ink-black/40 focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent transition-all resize-y"
              />
            </div>
          </div>

          {/* Step 4 Actions */}
          <div className="pt-4 border-t border-sand/30 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setCurrentStep(3)}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Previous: Travel Details
            </Button>
            <Button
              variant="primary"
              size="md"
              type="button"
              disabled={!step4Valid}
              onClick={() => setCurrentStep(5)}
              rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              Next: Review &amp; Generate
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 5: PREFERENCES & FINAL REVIEW */}
      {currentStep === 5 && (
        <div className="space-y-6">
          {/* Submission Failure Alert */}
          {submitError && (
            <div
              role="alert"
              className="bg-terracotta/10 border border-terracotta/30 text-ink-black p-4 rounded-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-terracotta shrink-0" aria-hidden="true" />
                <span className="font-sans text-xs sm:text-sm font-medium">{submitError}</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateChecklist}
                disabled={isSubmitting}
                className="shrink-0"
              >
                Retry Generation
              </Button>
            </div>
          )}

          {/* Personal Preferences Card */}
          <Card variant="scrapbook" hasTape className="p-5 sm:p-7 space-y-4">
            <div className="border-b border-sand/30 pb-3">
              <h2 className="font-serif font-bold text-lg sm:text-xl text-ink-black">
                5. Personal Preferences
              </h2>
              <p className="font-sans text-xs sm:text-sm text-ink-black/70 mt-0.5">
                Toggle optional specialized categories for remote work, health reminders, and photography.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUPPORTED_PREFERENCES.map((pref) => {
                const isSelected = preferences.personalPreferences.includes(pref.id)
                return (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => togglePreference(pref.id)}
                    aria-pressed={isSelected}
                    className={`p-3.5 rounded-card border text-left transition-all flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta cursor-pointer ${
                      isSelected
                        ? 'border-terracotta bg-terracotta/10 text-terracotta shadow-xs'
                        : 'border-sand/50 bg-warm-white/80 hover:bg-sand/15 text-ink-black'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-sm border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-terracotta border-terracotta text-warm-white'
                          : 'border-sand/70 bg-warm-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <span className="font-serif font-bold text-xs sm:text-sm block leading-snug">
                        {pref.label}
                      </span>
                      <span className="text-[10px] text-ink-black/60 font-sans block leading-tight mt-0.5">
                        {pref.desc}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Itinerary Review Card (Polaroid Ticket Aesthetic) */}
          <Card variant="ticket" padding="none" className="p-5 sm:p-7 space-y-5">
            <div className="border-b border-sand/30 pb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4 h-4 text-forest-green" aria-hidden="true" />
                  <span className="font-sans font-bold text-xs uppercase tracking-wider text-forest-green">
                    Ready for Generation
                  </span>
                </div>
                <h3 className="font-serif font-bold text-lg sm:text-xl text-ink-black leading-snug">
                  Itinerary &amp; Packing Overview
                </h3>
                <p className="font-sans text-xs text-ink-black/60 mt-0.5">
                  Verify your parameters below. You can edit any section before launching recommendation engine.
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-sans">
              {/* Section 1: Fundamentals */}
              <div className="p-3 bg-warm-white/80 rounded-card border border-sand/30 flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <span className="font-bold text-ink-black uppercase text-[10px] tracking-wider text-sand-700 block">
                    1. Journey Fundamentals
                  </span>
                  <p className="font-serif font-bold text-sm text-ink-black truncate">
                    {basics.name || 'Untitled Trip'}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-ink-black/75 pt-0.5 flex-wrap">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-ink-black/50 uppercase tracking-wide">From:</span>
                      <span className="font-medium text-ink-black">{basics.origin || 'Unspecified Origin'}</span>
                      {basics.originLocation && (
                        <Badge variant={basics.originLocation.coordinates ? 'forest' : 'sand'} size="sm">
                          {basics.originLocation.coordinates ? 'Geocoded' : 'Custom'}
                        </Badge>
                      )}
                    </span>
                    <span className="hidden sm:inline text-sand">&rarr;</span>
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-ink-black/50 uppercase tracking-wide">To:</span>
                      <span className="font-medium text-ink-black">{basics.destination || 'Unspecified Destination'}</span>
                      {basics.destinationLocation && (
                        <Badge variant={basics.destinationLocation.coordinates ? 'forest' : 'sand'} size="sm">
                          {basics.destinationLocation.coordinates ? 'Geocoded' : 'Custom'}
                        </Badge>
                      )}
                    </span>
                  </div>
                  {isSameCity && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-sans text-forest-green bg-forest-green/10 px-2 py-0.5 rounded-full border border-forest-green/20">
                      <Compass className="w-3 h-3 text-forest-green shrink-0" aria-hidden="true" />
                      <span>Local journey (same city)</span>
                    </span>
                  )}
                  <p className="flex items-center gap-1.5 text-ink-black/60 pt-0.5">
                    <Calendar className="w-3 h-3 text-sand shrink-0" />
                    <span>
                      {basics.startDate && basics.endDate
                        ? `${formatDisplayDate(basics.startDate)} – ${formatDisplayDate(
                            basics.endDate
                          )} (${dateValidation?.durationDays || 1} Days)`
                        : 'Dates unselected'}
                    </span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  leftIcon={<Edit2 className="w-3 h-3" />}
                  className="text-xs text-ink-black/70 hover:text-ink-black shrink-0"
                >
                  Edit
                </Button>
              </div>

              {/* Section 2: Travellers */}
              <div className="p-3 bg-warm-white/80 rounded-card border border-sand/30 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-bold text-ink-black uppercase text-[10px] tracking-wider text-sand-700 block">
                    2. Companions ({totalTravellers} Total)
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {travellers.adults > 0 && (
                      <Badge variant="sand" size="sm">
                        {`${travellers.adults} Adults`}
                      </Badge>
                    )}
                    {travellers.teens > 0 && (
                      <Badge variant="sand" size="sm">
                        {`${travellers.teens} Teens`}
                      </Badge>
                    )}
                    {travellers.children > 0 && (
                      <Badge variant="sand" size="sm">
                        {`${travellers.children} Children`}
                      </Badge>
                    )}
                    {travellers.infants > 0 && (
                      <Badge variant="sand" size="sm">
                        {`${travellers.infants} Infants`}
                      </Badge>
                    )}
                    {travellers.seniors > 0 && (
                      <Badge variant="sand" size="sm">
                        {`${travellers.seniors} Seniors`}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  leftIcon={<Edit2 className="w-3 h-3" />}
                  className="text-xs text-ink-black/70 hover:text-ink-black"
                >
                  Edit
                </Button>
              </div>

              {/* Section 3: Transit & Baggage */}
              <div className="p-3 bg-warm-white/80 rounded-card border border-sand/30 flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <span className="font-bold text-ink-black uppercase text-[10px] tracking-wider text-sand-700 block">
                    3. Transit &amp; Baggage
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" size="sm" className="capitalize">
                      {details.transportModes.join(', ')}
                    </Badge>
                    {details.accommodationType && (
                      <Badge variant="sand" size="sm" className="capitalize">
                        {details.accommodationType.replace('_', ' ')}
                      </Badge>
                    )}
                    <Badge
                      variant={details.hasLaundryAccess ? 'forest' : 'sand'}
                      size="sm"
                    >
                      {details.hasLaundryAccess ? 'Laundry Available' : 'No Laundry Access'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-ink-black/65">
                    Luggage Limits:{' '}
                    {details.baggageConfig.hasCabinBaggage
                      ? `Cabin: ${details.baggageConfig.cabinWeightLimitKg}kg`
                      : 'Cabin: Disabled'}
                    {' • '}
                    {details.baggageConfig.hasCheckedBaggage
                      ? `Checked: ${details.baggageConfig.checkedWeightLimitKg}kg`
                      : 'Checked: Disabled'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  leftIcon={<Edit2 className="w-3 h-3" />}
                  className="text-xs text-ink-black/70 hover:text-ink-black"
                >
                  Edit
                </Button>
              </div>

              {/* Section 4: Activities & Climate */}
              <div className="p-3 bg-warm-white/80 rounded-card border border-sand/30 flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <span className="font-bold text-ink-black uppercase text-[10px] tracking-wider text-sand-700 block">
                    4. Activities &amp; Climate
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activitiesData.activities.map((act) => (
                      <Badge key={act} variant="sand" size="sm" className="capitalize">
                        {act}
                      </Badge>
                    ))}
                    <Badge variant="outline" size="sm" className="capitalize">
                      {`Climate: ${activitiesData.climate}`}
                    </Badge>
                  </div>
                  {activitiesData.specialRequirements && (
                    <p className="text-[11px] text-ink-black/60 italic line-clamp-1">
                      Notes: &ldquo;{activitiesData.specialRequirements}&rdquo;
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  leftIcon={<Edit2 className="w-3 h-3" />}
                  className="text-xs text-ink-black/70 hover:text-ink-black"
                >
                  Edit
                </Button>
              </div>

              {/* Preferences Count */}
              {preferences.personalPreferences.length > 0 && (
                <div className="p-3 bg-warm-white/80 rounded-card border border-sand/30 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-ink-black uppercase text-[10px] tracking-wider text-sand-700 block">
                      Preferences Selected
                    </span>
                    <p className="text-xs text-ink-black/80 capitalize mt-0.5">
                      {preferences.personalPreferences.map((p) => p.replace('_', ' ')).join(', ')}
                    </p>
                  </div>
                  <Badge variant="sand" size="sm">
                    {`${preferences.personalPreferences.length} Active`}
                  </Badge>
                </div>
              )}
            </div>

            {/* Step 5 Generation Actions */}
            <div className="pt-4 border-t border-sand/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setCurrentStep(4)}
                disabled={isSubmitting}
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />}
                className="w-full sm:w-auto"
              >
                Previous: Activities
              </Button>

              <Button
                variant="primary"
                size="lg"
                type="button"
                disabled={!canGenerate || isSubmitting}
                onClick={handleGenerateChecklist}
                isLoading={isSubmitting}
                leftIcon={<Sparkles className="w-4 h-4" aria-hidden="true" />}
                className="w-full sm:w-auto font-bold shadow-md text-sm sm:text-base px-6 py-3"
              >
                {isSubmitting ? 'Consulting Packing Engine...' : 'Generate Packing Checklist'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
