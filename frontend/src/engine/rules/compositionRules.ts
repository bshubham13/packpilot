/**
 * PackPilot — Composition-Specific Recommendation Rules
 * Injects age-bracket specific travel essentials strictly based on exact counts
 * for Infants (0–2), Children (3–12), Teens (13–17), and Seniors (65+).
 */

import type { RecommendationCandidate, TripConfig } from '../../types'
import { getReferenceWeight } from '../referenceWeights'

export function evaluateCompositionRules(config: TripConfig): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = []
  const { travellers } = config

  if (!travellers) return candidates

  // Infant Rules (Ages 0–2)
  if (travellers.infants && travellers.infants > 0) {
    candidates.push(
      {
        itemSlug: 'fam-diapers-pack',
        name: 'Infant Diapers / Nappies',
        category: 'toiletries',
        priority: 'critical',
        quantityStrategy: 'per_person_per_day',
        quantityParams: {
          baseUnitsPerDay: 4,
          bufferUnits: 2,
          laundryRotationDays: 10,
          noLaundryMaxCap: 10,
        },
        targetAgeGroup: 'infants',
        weightGrams: getReferenceWeight('fam-diapers-pack'),
        isShared: false,
        reasons: [
          `Daily hygienic supplies (~4 units/day with transit buffer for ${travellers.infants} infant(s)). For trips beyond 7–10 days, pack for initial transit and purchase bulk packs at destination`,
        ],
      },
      {
        itemSlug: 'fam-baby-wipes',
        name: 'Hypoallergenic Baby Wipes (100-Pack)',
        category: 'toiletries',
        priority: 'critical',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 1, baseUnitsPerDay: 7 },
        targetAgeGroup: 'infants',
        weightGrams: getReferenceWeight('fam-baby-wipes'),
        isShared: true,
        reasons: ['Essential hygiene and sanitization for diaper changes and meals'],
      },
      {
        itemSlug: 'fam-infant-bottles',
        name: 'Infant Feeding Bottles & Formula Pack',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'per_person',
        quantityParams: { unitsPerPerson: 2, minQuantity: 2 },
        targetAgeGroup: 'infants',
        weightGrams: getReferenceWeight('fam-infant-bottles'),
        isShared: false,
        reasons: ['Sterile feeding and hydration during transit (2 bottles per infant)'],
      },
      {
        itemSlug: 'fam-travel-stroller',
        name: 'Compact Travel Stroller / Baby Carrier',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'per_person',
        quantityParams: { minQuantity: 1 },
        targetAgeGroup: 'infants',
        weightGrams: getReferenceWeight('fam-travel-stroller'),
        isShared: false,
        reasons: ['Airport gate-check stroller or ergonomic baby carrier for hands-free mobility'],
      }
    )
  }

  // Children Rules (Ages 3–12)
  if (travellers.children && travellers.children > 0) {
    candidates.push(
      {
        itemSlug: 'fam-kids-activities',
        name: 'Kids Travel Games, Coloring & Activity Kit',
        category: 'miscellaneous',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'children',
        weightGrams: getReferenceWeight('fam-kids-activities'),
        isShared: false,
        reasons: [`Engaging offline entertainment during long journeys for ${travellers.children} child(ren)`],
      },
      {
        itemSlug: 'health-pediatric-kit',
        name: 'Children’s Fever Reducer & Pediatric Essentials',
        category: 'health',
        priority: 'recommended',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 2 },
        targetAgeGroup: 'children',
        weightGrams: getReferenceWeight('health-pediatric-kit'),
        isShared: true,
        reasons: ['Pediatric-dosed paracetamol/ibuprofen and motion sickness relief'],
      }
    )
  }

  // Teenager Rules (Ages 13–17)
  if (travellers.teens && travellers.teens > 0) {
    candidates.push(
      {
        itemSlug: 'elec-teen-headphones',
        name: 'Personal Headphones / Earbuds',
        category: 'electronics',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'teens',
        weightGrams: getReferenceWeight('elec-teen-headphones'),
        isShared: false,
        reasons: [`Personal media audio for ${travellers.teens} teenager(s)`],
      },
      {
        itemSlug: 'fam-teen-daypack',
        name: 'Personal Teen Daypack / Backpack',
        category: 'gear',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'teens',
        weightGrams: getReferenceWeight('fam-teen-daypack'),
        isShared: false,
        reasons: ['Enables independent carry of personal items, jackets, and water'],
      }
    )
  }

  // Senior Rules (Ages 65+)
  if (travellers.seniors && travellers.seniors > 0) {
    candidates.push(
      {
        itemSlug: 'health-pill-organizer',
        name: 'Senior Daily Dosage Pill Dispenser',
        category: 'health',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'seniors',
        weightGrams: getReferenceWeight('health-pill-organizer'),
        isShared: false,
        reasons: [`Prescription medication organization for ${travellers.seniors} senior traveller(s)`],
      },
      {
        itemSlug: 'doc-insurance-card',
        name: 'Senior Emergency Medical Information Card',
        category: 'documents',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'seniors',
        weightGrams: getReferenceWeight('doc-insurance-card'),
        isShared: false,
        reasons: ['Carries vital details regarding blood group, conditions, and international insurance'],
      }
    )
  }

  return candidates
}
