import { describe, it, expect } from 'vitest'
import { evaluateBaseRules } from '../../src/engine/rules/baseRules'
import { evaluateTransportRules } from '../../src/engine/rules/transportRules'
import { evaluateClimateRules } from '../../src/engine/rules/climateRules'
import { evaluateAccommodationRules } from '../../src/engine/rules/accommodationRules'
import { evaluateActivityRules } from '../../src/engine/rules/activityRules'
import { evaluatePreferenceRules } from '../../src/engine/rules/preferenceRules'
import { evaluateCompositionRules } from '../../src/engine/rules/compositionRules'
import type { TripConfig } from '../../src/types'

function createMockTripConfig(overrides: Partial<TripConfig> = {}): TripConfig {
  return {
    name: 'Sample Expedition',
    destination: 'Interlaken, Switzerland',
    startDate: '2026-07-01',
    endDate: '2026-07-07',
    transportModes: ['flight'],
    activities: ['sightseeing'],
    climate: 'warm',
    accommodationType: 'hotel',
    travellers: {
      adults: 2,
      teens: 0,
      children: 0,
      infants: 0,
      seniors: 0,
    },
    personalPreferences: [],
    ...overrides,
  }
}

describe('Modular Recommendation Rules', () => {
  describe('Base Rules (evaluateBaseRules)', () => {
    it('generates universal travel essentials', () => {
      const candidates = evaluateBaseRules()
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('doc-id-card')
      expect(slugs).toContain('doc-payment-cards')
      expect(slugs).toContain('elec-phone-charger')
      expect(slugs).toContain('toil-dental-kit')
      expect(slugs).toContain('wear-underwear')
      expect(slugs).toContain('wear-socks')
    })

    it('assigns critical priority to core identity and payment documents', () => {
      const candidates = evaluateBaseRules()
      const idCard = candidates.find((c) => c.itemSlug === 'doc-id-card')
      const cards = candidates.find((c) => c.itemSlug === 'doc-payment-cards')

      expect(idCard?.priority).toBe('critical')
      expect(cards?.priority).toBe('critical')
    })
  })

  describe('Transport Rules (evaluateTransportRules)', () => {
    it('injects flight-specific essentials with globally neutral wording when flight is selected', () => {
      const config = createMockTripConfig({ transportModes: ['flight'] })
      const candidates = evaluateTransportRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('doc-passport')
      expect(slugs).toContain('doc-boarding-pass')
      expect(slugs).toContain('toil-cabin-liquids-bag')
      expect(slugs).toContain('elec-travel-headphones')

      // Check globally neutral identification wording (not passport-only)
      const travelId = candidates.find((c) => c.itemSlug === 'doc-passport')
      expect(travelId?.name).toBe('Valid Travel Identification (Passport / Government ID)')
      expect(travelId?.reasons[0]).toContain(
        'passport for international travel or accepted government-issued photo ID for domestic travel'
      )

      // Check globally neutral liquids bag wording (not TSA-specific)
      const liquidsBag = candidates.find((c) => c.itemSlug === 'toil-cabin-liquids-bag')
      expect(liquidsBag?.name).toBe('Transparent Resealable Cabin Liquids Bag')
      expect(liquidsBag?.reasons[0]).toContain('Transparent resealable cabin liquids bag')
      expect(liquidsBag?.reasons[0]).not.toContain('TSA 1-Quart')
    })

    it('injects motorcycle safety gear when bike is selected', () => {
      const config = createMockTripConfig({ transportModes: ['bike'] })
      const candidates = evaluateTransportRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('gear-moto-helmet')
      expect(slugs).toContain('wear-moto-jacket')
      expect(slugs).toContain('wear-moto-gloves')
      expect(slugs).toContain('gear-moto-repair-kit')
      expect(slugs).toContain('doc-vehicle-registration')

      const helmet = candidates.find((c) => c.itemSlug === 'gear-moto-helmet')
      expect(helmet?.priority).toBe('critical')
    })

    it('handles multiple simultaneous transport modes (Flight + Car)', () => {
      const config = createMockTripConfig({ transportModes: ['flight', 'car'] })
      const candidates = evaluateTransportRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      // Flight items
      expect(slugs).toContain('doc-passport')
      expect(slugs).toContain('toil-cabin-liquids-bag')
      // Car items
      expect(slugs).toContain('doc-driver-licence')
      expect(slugs).toContain('elec-car-mount')
      expect(slugs).toContain('gear-car-roadside-kit')
    })
  })

  describe('Climate Rules (evaluateClimateRules)', () => {
    it('injects thermal layers and winter jacket for cold climate', () => {
      const config = createMockTripConfig({ climate: 'cold' })
      const candidates = evaluateClimateRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('wear-thermal-layers')
      expect(slugs).toContain('wear-winter-jacket')
      expect(slugs).toContain('wear-beanie-gloves')

      const winterJacket = candidates.find((c) => c.itemSlug === 'wear-winter-jacket')
      expect(winterJacket?.priority).toBe('critical')
    })

    it('injects rain protection for rainy climate', () => {
      const config = createMockTripConfig({ climate: 'rainy' })
      const candidates = evaluateClimateRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('wear-rain-jacket')
      expect(slugs).toContain('gear-travel-umbrella')
      expect(slugs).toContain('gear-pack-raincover')
    })

    it('injects all-weather contingency layers for unknown climate', () => {
      const config = createMockTripConfig({ climate: 'unknown' })
      const candidates = evaluateClimateRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('wear-rain-jacket')
      expect(slugs).toContain('gear-travel-umbrella')
      expect(slugs).toContain('wear-fleece-layer')

      const rainShell = candidates.find((c) => c.itemSlug === 'wear-rain-jacket')
      expect(rainShell?.reasons[0]).toContain('unspecified')
    })
  })

  describe('Accommodation Rules (evaluateAccommodationRules)', () => {
    it('injects padlock and dorm accessories when staying at a hostel', () => {
      const config = createMockTripConfig({ accommodationType: 'hostel' })
      const candidates = evaluateAccommodationRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('gear-hostel-lock')
      expect(slugs).toContain('wear-dorm-earplugs')
      expect(slugs).toContain('wear-shower-sandals')
      expect(slugs).toContain('toil-quickdry-towel')

      const lock = candidates.find((c) => c.itemSlug === 'gear-hostel-lock')
      expect(lock?.priority).toBe('critical')
    })

    it('injects power strip and laundry pods for rental apartments', () => {
      const config = createMockTripConfig({ accommodationType: 'rental' })
      const candidates = evaluateAccommodationRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('elec-multi-plug')
      expect(slugs).toContain('toil-laundry-sheets')
    })

    it('does not inject hostel padlocks when staying at a hotel', () => {
      const config = createMockTripConfig({ accommodationType: 'hotel' })
      const candidates = evaluateAccommodationRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).not.toContain('gear-hostel-lock')
    })
  })

  describe('Activity Rules (evaluateActivityRules)', () => {
    it('injects beach essentials for beach activity', () => {
      const config = createMockTripConfig({ activities: ['beach'] })
      const candidates = evaluateActivityRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('wear-swimwear')
      expect(slugs).toContain('toil-sunscreen-spf50')
      expect(slugs).toContain('gear-sunglasses-uv')
      expect(slugs).toContain('gear-beach-bag')
    })

    it('injects technical trail gear for trekking activity', () => {
      const config = createMockTripConfig({ activities: ['trekking'] })
      const candidates = evaluateActivityRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('wear-trekking-boots')
      expect(slugs).toContain('wear-hiking-socks')
      expect(slugs).toContain('gear-water-bladder')
      expect(slugs).toContain('health-blister-kit')

      const boots = candidates.find((c) => c.itemSlug === 'wear-trekking-boots')
      expect(boots?.priority).toBe('critical')
    })

    it('injects camping equipment for camping activity', () => {
      const config = createMockTripConfig({ activities: ['camping'] })
      const candidates = evaluateActivityRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('gear-camp-tent')
      expect(slugs).toContain('gear-sleeping-bag')
      expect(slugs).toContain('gear-sleeping-pad')
      expect(slugs).toContain('elec-headlamp')
      expect(slugs).toContain('gear-camp-stove')
    })

    it('handles multiple activities (Beach + Trekking)', () => {
      const config = createMockTripConfig({ activities: ['beach', 'trekking'] })
      const candidates = evaluateActivityRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      // Both beach and trekking items are present
      expect(slugs).toContain('wear-swimwear')
      expect(slugs).toContain('wear-trekking-boots')
      expect(slugs).toContain('health-blister-kit')
    })
  })

  describe('Preference Rules (evaluatePreferenceRules)', () => {
    it('injects prescription medications as user-controlled reminder without prescribing dosage', () => {
      const config = createMockTripConfig({ personalPreferences: ['medications'] })
      const candidates = evaluatePreferenceRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('health-prescriptions')
      expect(slugs).toContain('doc-medical-note')
      expect(slugs).toContain('health-pill-organizer')
      expect(slugs).toContain('health-first-aid-kit')

      const meds = candidates.find((c) => c.itemSlug === 'health-prescriptions')
      expect(meds?.priority).toBe('critical')
      expect(meds?.name).toBe('Personal Prescription Medications Supply')
      expect(meds?.quantityStrategy).toBe('fixed')
      expect(meds?.quantityParams?.minQuantity).toBe(1)
      expect(meds?.reasons[0]).toContain('User-selected reminder: Pack an adequate personal supply')
    })

    it('injects work tech kit when work_tech is selected', () => {
      const config = createMockTripConfig({ personalPreferences: ['work_tech'] })
      const candidates = evaluatePreferenceRules(config)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('elec-work-laptop')
      expect(slugs).toContain('elec-mouse-hub')
      expect(slugs).toContain('elec-travel-adapter')
    })
  })

  describe('Composition Rules (evaluateCompositionRules)', () => {
    it('injects infant care items with scaling bottles and justified diaper parameters', () => {
      const configWithInfant = createMockTripConfig({
        travellers: { adults: 2, teens: 0, children: 0, infants: 2, seniors: 0 },
      })
      const candidatesWith = evaluateCompositionRules(configWithInfant)
      const slugsWith = candidatesWith.map((c) => c.itemSlug)

      expect(slugsWith).toContain('fam-diapers-pack')
      expect(slugsWith).toContain('fam-baby-wipes')
      expect(slugsWith).toContain('fam-infant-bottles')
      expect(slugsWith).toContain('fam-travel-stroller')

      // Check diaper parameters (no arbitrary 24 universal cap)
      const diapers = candidatesWith.find((c) => c.itemSlug === 'fam-diapers-pack')
      expect(diapers?.quantityParams?.baseUnitsPerDay).toBe(4)
      expect(diapers?.quantityParams?.bufferUnits).toBe(2)
      expect(diapers?.quantityParams?.noLaundryMaxCap).toBe(10)
      expect(diapers?.quantityParams?.maxQuantity).toBeUndefined()

      // Check infant feeding bottles scale with unitsPerPerson
      const bottles = candidatesWith.find((c) => c.itemSlug === 'fam-infant-bottles')
      expect(bottles?.quantityParams?.unitsPerPerson).toBe(2)

      // Config without infant
      const configNoInfant = createMockTripConfig({
        travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
      })
      const candidatesNo = evaluateCompositionRules(configNoInfant)
      const slugsNo = candidatesNo.map((c) => c.itemSlug)

      expect(slugsNo).not.toContain('fam-diapers-pack')
      expect(slugsNo).not.toContain('fam-travel-stroller')
    })

    it('injects teen-specific items when teens count > 0', () => {
      const configWithTeen = createMockTripConfig({
        travellers: { adults: 1, teens: 2, children: 0, infants: 0, seniors: 0 },
      })
      const candidates = evaluateCompositionRules(configWithTeen)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('elec-teen-headphones')
      expect(slugs).toContain('fam-teen-daypack')
    })

    it('injects senior health items when seniors count > 0', () => {
      const configWithSenior = createMockTripConfig({
        travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 1 },
      })
      const candidates = evaluateCompositionRules(configWithSenior)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('health-pill-organizer')
      expect(slugs).toContain('doc-insurance-card')

      const card = candidates.find((c) => c.itemSlug === 'doc-insurance-card')
      expect(card?.priority).toBe('critical')
    })
  })
})
