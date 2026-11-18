/**
 * PackPilot — Personal Preferences & User-Selected Options Rules
 * Injects user-requested items based on explicit preference toggles
 * (Medications, Work Tech, Photography, Formal Wear, First Aid).
 * Note: Medical items are user checklist reminders, never unsolicited medical diagnoses.
 */

import type { RecommendationCandidate, TripConfig } from '../../types'
import { getReferenceWeight } from '../referenceWeights'

export function evaluatePreferenceRules(config: TripConfig): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = []
  const prefs = config.personalPreferences || []

  // Prescription Medications Checklist Reminder
  if (prefs.includes('medications')) {
    candidates.push(
      {
        itemSlug: 'health-prescriptions',
        name: 'Personal Prescription Medications Supply',
        category: 'health',
        priority: 'critical',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('health-prescriptions'),
        isShared: false,
        reasons: [
          'User-selected reminder: Pack an adequate personal supply of required prescription medications in original labeled containers for your travel duration plus contingency delays',
        ],
      },
      {
        itemSlug: 'doc-medical-note',
        name: 'Doctor’s Prescription Copy & Letter',
        category: 'documents',
        priority: 'critical',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('doc-medical-note'),
        isShared: true,
        reasons: ['Legal documentation for border security and foreign pharmacy refills'],
      },
      {
        itemSlug: 'health-pill-organizer',
        name: 'Weekly Medication Pill Dispenser',
        category: 'health',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('health-pill-organizer'),
        isShared: false,
        reasons: ['Organizes daily dosages and keeps medication dry and accessible'],
      }
    )
  }

  // Work Tech Kit
  if (prefs.includes('work_tech')) {
    candidates.push(
      {
        itemSlug: 'elec-work-laptop',
        name: 'Work Laptop & Power Supply',
        category: 'electronics',
        priority: 'critical',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults',
        weightGrams: getReferenceWeight('elec-work-laptop'),
        isShared: false,
        reasons: ['User-selected preference: Remote work and digital tasks'],
      },
      {
        itemSlug: 'elec-mouse-hub',
        name: 'Ergonomic Mouse & USB-C Multiport Hub',
        category: 'electronics',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'adults',
        weightGrams: getReferenceWeight('elec-mouse-hub'),
        isShared: false,
        reasons: ['Workstation ergonomics and peripheral device expansion'],
      },
      {
        itemSlug: 'elec-travel-adapter',
        name: 'All-in-One Universal Travel Adapter',
        category: 'electronics',
        priority: 'critical',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('elec-travel-adapter'),
        isShared: true,
        reasons: ['Ensures laptop and devices can connect to foreign wall outlet sockets'],
      }
    )
  }

  // Photography Gear
  if (prefs.includes('photography')) {
    candidates.push(
      {
        itemSlug: 'elec-camera-body',
        name: 'Dedicated Camera Body & Primary Lens',
        category: 'electronics',
        priority: 'recommended',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('elec-camera-body'),
        isShared: true,
        reasons: ['User-selected preference: Travel photography and landscape capture'],
      },
      {
        itemSlug: 'elec-camera-batteries',
        name: 'Spare Camera Batteries & Battery Charger',
        category: 'electronics',
        priority: 'critical',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 2 },
        weightGrams: getReferenceWeight('elec-camera-batteries'),
        isShared: true,
        reasons: ['Ensures continuous camera operation on full-day photo excursions'],
      }
    )
  }

  // General Travel First Aid
  if (prefs.includes('first_aid') || prefs.includes('medications')) {
    candidates.push({
      itemSlug: 'health-first-aid-kit',
      name: 'Compact Travel First-Aid Kit',
      category: 'health',
      priority: 'recommended',
      quantityStrategy: 'shared_capacity',
      quantityParams: { capacityPerUnit: 4 },
      weightGrams: getReferenceWeight('health-first-aid-kit'),
      isShared: true,
      reasons: ['Antiseptic wipes, sterile gauze, band-aids, and pain relief essentials'],
    })
  }

  return candidates
}
