/**
 * PackPilot — Climate & Weather Recommendation Rules
 * Adapts clothing layers, weather protection, and skin health gear
 * to destination climate conditions (Cold, Rainy, Warm, Mixed, Unknown).
 */

import type { RecommendationCandidate, TripConfig } from '../../types'
import { getReferenceWeight } from '../referenceWeights'

export function evaluateClimateRules(config: TripConfig): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = []
  const climate = config.climate || 'unknown'

  // Cold Weather Rules
  if (climate === 'cold' || climate === 'mixed') {
    candidates.push(
      {
        itemSlug: 'wear-thermal-layers',
        name: 'Thermal Base Layer Tops & Bottoms',
        category: 'clothing',
        priority: climate === 'cold' ? 'critical' : 'recommended',
        quantityStrategy: 'per_person_per_day',
        quantityParams: {
          laundryRotationDays: 4,
          noLaundryMaxCap: 6,
          minQuantity: 1,
        },
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-thermal-layers'),
        isShared: false,
        reasons: [`Sub-zero and low-temperature thermal insulation (${climate} climate)`],
      },
      {
        itemSlug: 'wear-winter-jacket',
        name: 'Insulated Down or Heavy Winter Coat',
        category: 'clothing',
        priority: climate === 'cold' ? 'critical' : 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-winter-jacket'),
        isShared: false,
        reasons: [`Primary outer thermal protection against freezing ambient temperatures (${climate} climate)`],
      },
      {
        itemSlug: 'wear-beanie-gloves',
        name: 'Thermal Knit Beanie & Winter Gloves',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-beanie-gloves'),
        isShared: false,
        reasons: ['Extremity warmth preventing windburn and frostbite'],
      },
      {
        itemSlug: 'wear-fleece-layer',
        name: 'Fleece Midlayer / Wool Sweater',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-fleece-layer'),
        isShared: false,
        reasons: ['Versatile insulating mid-layer for variable cool weather'],
      },
      {
        itemSlug: 'toil-lip-balm',
        name: 'Moisturizing Lip Balm with Beeswax/SPF',
        category: 'toiletries',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('toil-lip-balm'),
        isShared: false,
        reasons: ['Prevents chapped lips from dry, biting cold winds'],
      }
    )
  }

  // Rainy Weather Rules
  if (climate === 'rainy' || climate === 'mixed') {
    candidates.push(
      {
        itemSlug: 'wear-rain-jacket',
        name: 'Waterproof Breathable Rain Jacket / Shell',
        category: 'clothing',
        priority: climate === 'rainy' ? 'critical' : 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-rain-jacket'),
        isShared: false,
        reasons: [`Waterproof and windproof outer shell for downpours (${climate} climate)`],
      },
      {
        itemSlug: 'gear-travel-umbrella',
        name: 'Windproof Compact Travel Umbrella',
        category: 'gear',
        priority: 'recommended',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 2 },
        weightGrams: getReferenceWeight('gear-travel-umbrella'),
        isShared: true,
        reasons: ['Instant rain coverage during urban walks and transit transfers'],
      },
      {
        itemSlug: 'gear-pack-raincover',
        name: 'Waterproof Backpack Cover / Dry Sack',
        category: 'gear',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('gear-pack-raincover'),
        isShared: false,
        reasons: ['Protects luggage and electronics from moisture in transit'],
      }
    )
  }

  // Warm Weather Rules
  if (climate === 'warm' || climate === 'mixed') {
    candidates.push(
      {
        itemSlug: 'wear-sun-hat',
        name: 'Wide-Brim Sun Hat / Breathable Cap',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-sun-hat'),
        isShared: false,
        reasons: ['Shields face and neck from intense solar UV exposure'],
      },
      {
        itemSlug: 'toil-sunscreen-spf50',
        name: 'Broad-Spectrum Sunscreen SPF 50+',
        category: 'toiletries',
        priority: 'recommended',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 3, baseUnitsPerDay: 10 },
        weightGrams: getReferenceWeight('toil-sunscreen-spf50'),
        isShared: true,
        reasons: ['Essential dermatological UV protection against sunburn'],
      },
      {
        itemSlug: 'health-electrolytes',
        name: 'Hydration Electrolyte Tablets / Powder',
        category: 'health',
        priority: 'optional',
        quantityStrategy: 'per_person_per_day',
        quantityParams: { bufferUnits: 1 },
        targetAgeGroup: 'adults_and_teens',
        weightGrams: getReferenceWeight('health-electrolytes'),
        isShared: false,
        reasons: ['Replenishes essential salts lost to perspiration in high heat'],
      }
    )
  }

  // Conservative Fallback for Unknown Climate
  if (climate === 'unknown') {
    candidates.push(
      {
        itemSlug: 'wear-rain-jacket',
        name: 'Versatile All-Weather Wind & Rain Shell',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-rain-jacket'),
        isShared: false,
        reasons: ['Conservative contingency layer because destination climate was unspecified'],
      },
      {
        itemSlug: 'gear-travel-umbrella',
        name: 'Compact Travel Umbrella',
        category: 'gear',
        priority: 'optional',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 2 },
        weightGrams: getReferenceWeight('gear-travel-umbrella'),
        isShared: true,
        reasons: ['Precautionary rain coverage for unpredictable weather'],
      },
      {
        itemSlug: 'wear-fleece-layer',
        name: 'Light Cardigan or Fleece Layer',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-fleece-layer'),
        isShared: false,
        reasons: ['Adaptable layering piece for unexpected temperature drops'],
      }
    )
  }

  return candidates
}
