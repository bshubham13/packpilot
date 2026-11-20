/**
 * PackPilot — Transport-Specific Recommendation Rules
 * Rules activated based on selected transit modes (Flight, Bike, Car, Train, Bus).
 */

import type { RecommendationCandidate, TripConfig } from '../../types'
import { getReferenceWeight } from '../referenceWeights'

export function evaluateTransportRules(config: TripConfig): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = []
  const modes = config.transportModes || []

  // Flight Rules
  if (modes.includes('flight')) {
    candidates.push(
      {
        itemSlug: 'doc-passport',
        name: 'Valid Travel Identification (Passport / Government ID)',
        category: 'documents',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('doc-passport'),
        isShared: false,
        reasons: [
          'Valid travel identification — passport for international travel or accepted government-issued photo ID for domestic travel',
        ],
      },
      {
        itemSlug: 'doc-boarding-pass',
        name: 'Airline Boarding Passes / E-Tickets',
        category: 'documents',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('doc-boarding-pass'),
        isShared: false,
        reasons: ['Mandatory for airport security check-in and boarding gates'],
      },
      {
        itemSlug: 'toil-cabin-liquids-bag',
        name: 'Transparent Resealable Cabin Liquids Bag',
        category: 'toiletries',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('toil-cabin-liquids-bag'),
        isShared: false,
        reasons: [
          'Transparent resealable cabin liquids bag — check the applicable airport and airline restrictions (typically containers ≤ 100ml / 3.4oz)',
        ],
      },
      {
        itemSlug: 'elec-travel-headphones',
        name: 'Noise-Cancelling Headphones / Earplugs',
        category: 'electronics',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('elec-travel-headphones'),
        isShared: false,
        reasons: ['Cabin ambient noise dampening and inflight entertainment'],
      },
      {
        itemSlug: 'misc-customs-pen',
        name: 'Black/Blue Pen for Customs Forms',
        category: 'miscellaneous',
        priority: 'recommended',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('misc-customs-pen'),
        isShared: true,
        reasons: ['Inflight completion of immigration and customs declaration cards'],
      },
      {
        itemSlug: 'wear-flight-comfort',
        name: 'Travel Neck Pillow & Compression Socks',
        category: 'clothing',
        priority: 'optional',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults_and_teens',
        weightGrams: getReferenceWeight('wear-flight-comfort'),
        isShared: false,
        reasons: ['Long-haul flight circulation and rest comfort'],
      }
    )
  }

  // Bike / Motorcycle Rules
  if (modes.includes('bike')) {
    candidates.push(
      {
        itemSlug: 'gear-moto-helmet',
        name: 'DOT/ECE Certified Helmet',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('gear-moto-helmet'),
        isShared: false,
        reasons: ['Mandatory rider safety equipment and legal road requirement'],
      },
      {
        itemSlug: 'wear-moto-jacket',
        name: 'Armored Riding Jacket & Protective Gear',
        category: 'clothing',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults_and_teens',
        weightGrams: getReferenceWeight('wear-moto-jacket'),
        isShared: false,
        reasons: ['Abrasion and impact protection during road touring'],
      },
      {
        itemSlug: 'wear-moto-gloves',
        name: 'Reinforced Riding Gloves',
        category: 'clothing',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults_and_teens',
        weightGrams: getReferenceWeight('wear-moto-gloves'),
        isShared: false,
        reasons: ['Grip control and weather protection for hands'],
      },
      {
        itemSlug: 'wear-moto-rainsuit',
        name: 'Motorcycle Waterproof Oversuit',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults_and_teens',
        weightGrams: getReferenceWeight('wear-moto-rainsuit'),
        isShared: false,
        reasons: ['Complete highway rain protection over riding gear'],
      },
      {
        itemSlug: 'gear-moto-repair-kit',
        name: 'Tyre Puncture Kit & 12V Air Pump',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 2 },
        weightGrams: getReferenceWeight('gear-moto-repair-kit'),
        isShared: true,
        reasons: ['Emergency roadside roadside tyre repair and inflation'],
      },
      {
        itemSlug: 'doc-vehicle-registration',
        name: 'Vehicle Registration & Insurance Documents',
        category: 'documents',
        priority: 'critical',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('doc-vehicle-registration'),
        isShared: true,
        reasons: ['Legal vehicle ownership verification for law enforcement inspections'],
      }
    )
  }

  // Car Rules
  if (modes.includes('car')) {
    candidates.push(
      {
        itemSlug: 'doc-driver-licence',
        name: 'Valid Driver’s Licence & IDP',
        category: 'documents',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults',
        weightGrams: getReferenceWeight('doc-driver-licence'),
        isShared: false,
        reasons: ['Legal motor vehicle operation and rental car desk verification'],
      },
      {
        itemSlug: 'elec-car-mount',
        name: 'Smartphone Dashboard Mount & Car Charger',
        category: 'electronics',
        priority: 'recommended',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('elec-car-mount'),
        isShared: true,
        reasons: ['Hands-free GPS navigation and continuous device power on road trips'],
      },
      {
        itemSlug: 'gear-car-roadside-kit',
        name: 'Emergency Roadside Kit & Jumper Cables',
        category: 'gear',
        priority: 'recommended',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('gear-car-roadside-kit'),
        isShared: true,
        reasons: ['Battery jump-starts, basic roadside repairs, and breakdown visibility'],
      },
      {
        itemSlug: 'gear-car-flashlight',
        name: 'Emergency LED Flashlight & Flare',
        category: 'gear',
        priority: 'optional',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('gear-car-flashlight'),
        isShared: true,
        reasons: ['Nighttime vehicle inspections and emergency signalling'],
      }
    )
  }

  // Train Rules
  if (modes.includes('train')) {
    candidates.push(
      {
        itemSlug: 'doc-train-ticket',
        name: 'Train Passes & Seat Reservations',
        category: 'documents',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('doc-train-ticket'),
        isShared: false,
        reasons: ['Conductor ticket inspection and platform turnstiles'],
      },
      {
        itemSlug: 'misc-reading-book',
        name: 'Paperback Book / E-Reader',
        category: 'miscellaneous',
        priority: 'optional',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults_and_teens',
        weightGrams: getReferenceWeight('misc-reading-book'),
        isShared: false,
        reasons: ['Offline entertainment during rail journeys'],
      }
    )

    // Preserve justified overnight blanket recommendation only when overnight transit is explicitly chosen
    if (config.overnightSelection === 'yes') {
      candidates.push({
        itemSlug: 'wear-travel-blanket',
        name: 'Compact Travel Wrap / Light Blanket',
        category: 'clothing',
        priority: 'optional',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-travel-blanket'),
        isShared: false,
        reasons: ['Chilly air-conditioned train carriages and overnight sleepers'],
      })
    }
  }

  return candidates
}
