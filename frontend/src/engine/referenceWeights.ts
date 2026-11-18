/**
 * PackPilot — Curated Reference Weight Catalog
 * Realistic baseline weights in grams based on average consumer travel gear.
 * Missing items return undefined so they remain explicitly unknown.
 */

export const REFERENCE_WEIGHTS: Record<string, number> = {
  // Documents
  'doc-travel-id': 45,
  'doc-passport': 45,
  'doc-id-card': 15,
  'doc-payment-cards': 20,
  'doc-cash-reserve': 20,
  'doc-boarding-pass': 0,
  'doc-vehicle-registration': 15,
  'doc-driver-licence': 15,
  'doc-train-ticket': 10,
  'doc-medical-note': 10,
  'doc-insurance-card': 10,

  // Clothing & Footwear
  'wear-underwear': 60,
  'wear-socks': 60,
  'wear-hiking-socks': 75,
  'wear-tshirt': 150,
  'wear-warm-shirts': 140,
  'wear-pants': 550,
  'wear-sleepwear': 250,
  'wear-rain-jacket': 380,
  'wear-winter-jacket': 750,
  'wear-thermal-layers': 280,
  'wear-fleece-layer': 350,
  'wear-beanie-gloves': 130,
  'wear-sun-hat': 110,
  'wear-swimwear': 180,
  'wear-formal-shirts': 220,
  'wear-suit-blazer': 650,
  'wear-dress-shoes': 750,
  'wear-walking-sneakers': 680,
  'wear-trekking-boots': 1100,
  'wear-shower-sandals': 200,
  'wear-moto-jacket': 1800,
  'wear-moto-gloves': 220,
  'wear-moto-rainsuit': 650,
  'wear-travel-blanket': 290,
  'wear-flight-comfort': 180,
  'wear-dorm-earplugs': 30,

  // Toiletries
  'toil-dental-kit': 110,
  'toil-deodorant': 85,
  'toil-sunscreen-spf50': 150,
  'toil-lip-balm': 15,
  'toil-quickdry-towel': 220,
  'toil-cabin-liquids-bag': 35,
  'toil-tsa-liquid-bag': 35,
  'toil-tissues-wipes': 50,
  'toil-insect-repellent': 140,
  'toil-laundry-sheets': 40,

  // Electronics
  'elec-phone-charger': 120,
  'elec-power-bank': 220,
  'elec-travel-adapter': 150,
  'elec-multi-plug': 280,
  'elec-travel-headphones': 250,
  'elec-work-laptop': 1800,
  'elec-mouse-hub': 140,
  'elec-camera-body': 1100,
  'elec-camera-batteries': 210,
  'elec-headlamp': 95,
  'elec-car-mount': 140,
  'elec-pres-clicker': 80,
  'elec-teen-headphones': 200,

  // Gear & Equipment
  'gear-camp-tent': 2200,
  'gear-sleeping-bag': 1200,
  'gear-sleeping-pad': 520,
  'gear-camp-stove': 410,
  'gear-water-bladder': 250,
  'gear-trekking-poles': 480,
  'gear-sunglasses-uv': 40,
  'gear-hostel-lock': 120,
  'gear-travel-umbrella': 290,
  'gear-daypack-light': 350,
  'gear-pack-raincover': 90,
  'gear-beach-bag': 190,
  'gear-moto-helmet': 1500,
  'gear-moto-repair-kit': 850,
  'gear-car-roadside-kit': 2500,
  'gear-car-flashlight': 320,

  // Health & Safety
  'health-prescriptions': 100,
  'health-pill-organizer': 60,
  'health-blister-kit': 30,
  'health-electrolytes': 60,
  'health-first-aid-kit': 320,
  'health-pediatric-kit': 180,

  // Baby & Family Care
  'fam-diapers-pack': 750,
  'fam-baby-wipes': 350,
  'fam-infant-bottles': 450,
  'fam-travel-stroller': 4500,
  'fam-kids-activities': 250,
  'fam-teen-daypack': 300,

  // Miscellaneous
  'misc-customs-pen': 12,
  'misc-reading-book': 210,
}

/**
 * Retrieves the curated reference weight in grams for a given item slug.
 * Returns undefined if no verified baseline weight exists.
 * Unknown and custom items strictly return undefined; never substitute an arbitrary default fallback.
 */
export function getReferenceWeight(itemSlug: string): number | undefined {
  if (!itemSlug || typeof itemSlug !== 'string') {
    return undefined
  }
  return REFERENCE_WEIGHTS[itemSlug]
}
