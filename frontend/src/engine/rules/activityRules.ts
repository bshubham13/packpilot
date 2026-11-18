/**
 * PackPilot — Activity-Specific Recommendation Rules
 * Injects specialized equipment and clothing based on selected trip activities
 * (Beach, Trekking, Camping, Business, Sightseeing, Adventure, Relaxation).
 */

import type { RecommendationCandidate, TripConfig } from '../../types'
import { getReferenceWeight } from '../referenceWeights'

export function evaluateActivityRules(config: TripConfig): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = []
  const activities = config.activities || []

  // Beach Activity
  if (activities.includes('beach')) {
    candidates.push(
      {
        itemSlug: 'wear-swimwear',
        name: 'Swimwear / Boardshorts / Bathing Suit',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        quantityParams: { minQuantity: 2 },
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-swimwear'),
        isShared: false,
        reasons: ['Swimming, ocean activities, and resort pools'],
      },
      {
        itemSlug: 'toil-sunscreen-spf50',
        name: 'Water-Resistant Sunscreen SPF 50+',
        category: 'toiletries',
        priority: 'recommended',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 3, baseUnitsPerDay: 10 },
        weightGrams: getReferenceWeight('toil-sunscreen-spf50'),
        isShared: true,
        reasons: ['Intense UV reflection from sand and open water'],
      },
      {
        itemSlug: 'gear-sunglasses-uv',
        name: 'Polarized Sunglasses (UV400)',
        category: 'gear',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('gear-sunglasses-uv'),
        isShared: false,
        reasons: ['Protects retinas from glare and intense coastal sunshine'],
      },
      {
        itemSlug: 'gear-beach-bag',
        name: 'Packable Beach Tote / Water-Resistant Bag',
        category: 'gear',
        priority: 'optional',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('gear-beach-bag'),
        isShared: true,
        reasons: ['Carrying towels, sun lotion, and books across sandy shores'],
      }
    )
  }

  // Trekking Activity
  if (activities.includes('trekking')) {
    candidates.push(
      {
        itemSlug: 'wear-trekking-boots',
        name: 'Ankle-Support Waterproof Hiking Boots',
        category: 'clothing',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-trekking-boots'),
        isShared: false,
        reasons: ['Traction and ankle stabilization over uneven rocky terrain'],
      },
      {
        itemSlug: 'wear-hiking-socks',
        name: 'Merino Wool Anti-Blister Hiking Socks',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person_per_day',
        quantityParams: {
          laundryRotationDays: 3,
          noLaundryMaxCap: 4,
          minQuantity: 2,
        },
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-hiking-socks'),
        isShared: false,
        reasons: ['Cushioning and moisture-wicking to prevent friction blisters'],
      },
      {
        itemSlug: 'gear-water-bladder',
        name: 'Hydration Pack / 2L Water Reservoir',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('gear-water-bladder'),
        isShared: false,
        reasons: ['Hands-free trail hydration to prevent altitude and heat exhaustion'],
      },
      {
        itemSlug: 'gear-trekking-poles',
        name: 'Collapsible Trekking Poles (Pair)',
        category: 'gear',
        priority: 'optional',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults_and_teens',
        weightGrams: getReferenceWeight('gear-trekking-poles'),
        isShared: false,
        reasons: ['Reduces knee joint impact on steep mountain descents'],
      },
      {
        itemSlug: 'health-blister-kit',
        name: 'Hydrocolloid Blister Kit & Moleskin',
        category: 'health',
        priority: 'critical',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 3 },
        weightGrams: getReferenceWeight('health-blister-kit'),
        isShared: true,
        reasons: ['Immediate field treatment for hotspots and foot friction'],
      }
    )
  }

  // Camping Activity
  if (activities.includes('camping')) {
    candidates.push(
      {
        itemSlug: 'gear-camp-tent',
        name: 'Weatherproof 2-Person Camping Tent',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 2 },
        weightGrams: getReferenceWeight('gear-camp-tent'),
        isShared: true,
        reasons: ['Primary shelter against wind, rain, and insects at night'],
      },
      {
        itemSlug: 'gear-sleeping-bag',
        name: 'Temperature-Rated Sleeping Bag',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('gear-sleeping-bag'),
        isShared: false,
        reasons: ['Body heat retention during cold outdoor wilderness nights'],
      },
      {
        itemSlug: 'gear-sleeping-pad',
        name: 'Insulated Inflatable Sleeping Mat',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('gear-sleeping-pad'),
        isShared: false,
        reasons: ['Thermal barrier preventing ground chill conductive heat loss'],
      },
      {
        itemSlug: 'elec-headlamp',
        name: 'Hands-Free LED Headlamp & Extra Batteries',
        category: 'electronics',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('elec-headlamp'),
        isShared: false,
        reasons: ['Nighttime campsite navigation and camp cooking illumination'],
      },
      {
        itemSlug: 'gear-camp-stove',
        name: 'Compact Canister Stove & Cookware Set',
        category: 'gear',
        priority: 'recommended',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 4 },
        weightGrams: getReferenceWeight('gear-camp-stove'),
        isShared: true,
        reasons: ['Boiling drinking water and preparing hot wilderness meals'],
      },
      {
        itemSlug: 'toil-insect-repellent',
        name: 'Insect Repellent Spray (DEET 30%+)',
        category: 'toiletries',
        priority: 'recommended',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 3 },
        weightGrams: getReferenceWeight('toil-insect-repellent'),
        isShared: true,
        reasons: ['Deters mosquitoes, ticks, and midges around backcountry campsites'],
      }
    )
  }

  // Business Activity
  if (activities.includes('business')) {
    candidates.push(
      {
        itemSlug: 'wear-formal-shirts',
        name: 'Business Dress Shirts / Blouses',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person_per_day',
        quantityParams: {
          laundryRotationDays: 4,
          noLaundryMaxCap: 5,
          minQuantity: 1,
        },
        targetAgeGroup: 'adults',
        weightGrams: getReferenceWeight('wear-formal-shirts'),
        isShared: false,
        reasons: ['Professional attire for client presentations and board meetings'],
      },
      {
        itemSlug: 'wear-suit-blazer',
        name: 'Tailored Blazer / Suit Jacket',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults',
        weightGrams: getReferenceWeight('wear-suit-blazer'),
        isShared: false,
        reasons: ['Executive formal layer for corporate environments'],
      },
      {
        itemSlug: 'wear-dress-shoes',
        name: 'Formal Leather Shoes / Dress Flats',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults',
        weightGrams: getReferenceWeight('wear-dress-shoes'),
        isShared: false,
        reasons: ['Appropriate professional footwear for corporate dress codes'],
      },
      {
        itemSlug: 'elec-work-laptop',
        name: 'Work Laptop & High-Wattage Charger',
        category: 'electronics',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults',
        weightGrams: getReferenceWeight('elec-work-laptop'),
        isShared: false,
        reasons: ['Core business productivity and remote client communications'],
      },
      {
        itemSlug: 'elec-pres-clicker',
        name: 'Presentation Remote & HDMI Adapter',
        category: 'electronics',
        priority: 'optional',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('elec-pres-clicker'),
        isShared: true,
        reasons: ['Seamless slide deck delivery in client conference rooms'],
      }
    )
  }

  // Sightseeing & Urban Touring Activity
  if (activities.includes('sightseeing')) {
    candidates.push(
      {
        itemSlug: 'wear-walking-sneakers',
        name: 'Comfortable Walking Sneakers',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-walking-sneakers'),
        isShared: false,
        reasons: ['Cushioning for high daily step counts across urban cobblestones and museums'],
      },
      {
        itemSlug: 'gear-daypack-light',
        name: 'Lightweight City Daypack (15–20L)',
        category: 'gear',
        priority: 'recommended',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 2 },
        weightGrams: getReferenceWeight('gear-daypack-light'),
        isShared: true,
        reasons: ['Daytime carry for jackets, water bottles, and souvenirs'],
      },
      {
        itemSlug: 'gear-sunglasses-uv',
        name: 'UV400 Sunglasses',
        category: 'gear',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('gear-sunglasses-uv'),
        isShared: false,
        reasons: ['Eye protection during sunny outdoor walking tours'],
      }
    )
  }

  return candidates
}
