/**
 * PackPilot — Accommodation-Specific Recommendation Rules
 * Adapts items based on where the traveller is staying (Hostel, Hotel, Rental, Camping).
 */

import type { RecommendationCandidate, TripConfig } from '../../types'
import { getReferenceWeight } from '../referenceWeights'

export function evaluateAccommodationRules(config: TripConfig): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = []
  const acc = config.accommodationType

  if (!acc) return candidates

  // Hostel Rules
  if (acc === 'hostel') {
    candidates.push(
      {
        itemSlug: 'gear-hostel-lock',
        name: 'Combination Luggage/Locker Padlock',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults_and_teens',
        weightGrams: getReferenceWeight('gear-hostel-lock'),
        isShared: false,
        reasons: ['Securing valuables inside dormitory storage lockers'],
      },
      {
        itemSlug: 'wear-dorm-earplugs',
        name: 'Contoured Sleep Mask & Soft Earplugs',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-dorm-earplugs'),
        isShared: false,
        reasons: ['Blocks out light and snoring in shared hostel dormitories'],
      },
      {
        itemSlug: 'wear-shower-sandals',
        name: 'Quick-Drying Shower Sandals / Sliders',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-shower-sandals'),
        isShared: false,
        reasons: ['Hygiene barrier for communal hostel shower facilities'],
      },
      {
        itemSlug: 'toil-quickdry-towel',
        name: 'Microfibre Fast-Drying Bath Towel',
        category: 'toiletries',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('toil-quickdry-towel'),
        isShared: false,
        reasons: ['Hostels typically charge rental fees for bath towels'],
      }
    )
  }

  // Vacation Rental / Apartment / Airbnb Rules
  if (acc === 'rental') {
    candidates.push(
      {
        itemSlug: 'elec-multi-plug',
        name: 'Travel Multi-Plug Power Strip',
        category: 'electronics',
        priority: 'recommended',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('elec-multi-plug'),
        isShared: true,
        reasons: ['Expands limited or awkwardly placed wall outlets in rental apartments'],
      },
      {
        itemSlug: 'toil-laundry-sheets',
        name: 'Travel Laundry Detergent Eco-Sheets',
        category: 'toiletries',
        priority: 'recommended',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('toil-laundry-sheets'),
        isShared: true,
        reasons: ['Allows washing clothes in apartment washing machines without buying bulk powder'],
      }
    )
  }

  return candidates
}
