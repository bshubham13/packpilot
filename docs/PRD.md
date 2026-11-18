# PackPilot — Product Requirements Document (PRD)

**Document Reference:** PRD-PACKPILOT-V1  
**Version:** 1.4.0 (Final Milestone 1 Refinement)  
**Target Release:** PackPilot V1 MVP  
**Status:** Implementation Ready (Awaiting Final PO Approval)  

---

## 1. Overview & Objectives

PackPilot is an offline-capable, local-first web application designed to help travellers plan, personalize, and complete packing checklists. By leveraging a deterministic recommendation engine running directly in the browser, PackPilot eliminates travel preparation anxiety without sacrificing user privacy or requiring subscriptions.

### High-Level Success Objectives
1. Provide an intuitive, multi-step Trip Wizard that captures travel parameters in under 90 seconds.
2. Generate an accurate, context-aware packing checklist categorized into logical travel buckets (Clothing, Documents, Toiletries, Electronics, Activity Gear, Health/First Aid, Miscellaneous).
3. Support partial packing tracking (`packedQuantity` of `effectiveQuantity`) with real-time readiness scoring and dual-baggage weight estimation.
4. Support full CRUD for trips, custom checklist items, and packing templates with a storage abstraction supporting IndexedDB and in-memory fallback.
5. Provide safe JSON backup and restore capabilities to guard against browser cache evictions.

---

## 2. Feature Specifications

### Feature A: Landing Page
- Hero section with editorial typography, primary CTA ("Plan a New Trip"), and secondary CTA ("Explore Templates").
- Value proposition highlights (100% Local-First & Private, Smart Quantity Logic, Readiness Score, Dual-Baggage Weight Estimator).
- Interactive "How It Works" 3-step walkthrough.
- Interactive preview card demonstrating a sample travel scrapbook checklist.

### Feature B: Trip Creation Wizard
- **Step 1: Core Trip Basics (Required)**
  - `tripName`: String (1–80 chars, e.g. "Kyoto Autumn Expedition").
  - `destination`: String (1–100 chars, e.g. "Kyoto, Japan").
  - `startDate`: Valid ISO Date (YYYY-MM-DD).
  - `endDate`: Valid ISO Date (YYYY-MM-DD, must be $\ge$ `startDate`).
- **Step 2: Transport & Transit (Required / Multi-select)**
  - Modes: `Flight`, `Train`, `Car`, `Bike`, `Bus`, `Other`.
- **Step 3: Purpose & Activities (Required / Multi-select)**
  - Activity list: `Beach`, `Sightseeing`, `Trekking`, `Adventure`, `Business`, `Camping`, `Family trip`, `Relaxation`.
- **Step 4: Contextual Weather & Climate (Optional / Single-select)**
  - Options: `Warm`, `Cold`, `Rainy`, `Mixed`, `Unknown` (default).
- **Step 5: Accommodation, Dual Baggage, Composition & Preferences (Optional)**
  - Accommodation type: `Hotel/Resort`, `Hostel`, `Rental Apartment/Airbnb`, `Camping Tent`, `Staying with Friends/Family`.
  - Dual Baggage Configuration:
    - Cabin Baggage toggle (default: true) & limit (presets: 7kg, 8kg, 10kg, custom).
    - Checked Baggage toggle (default: false) & limit (presets: 20kg, 23kg, 32kg, custom).
  - Traveller Composition (Contiguous non-overlapping age groups):
    - Adults: 18–64 years (min 1, default 1)
    - Teens: 13–17 years (default 0)
    - Children: 3–12 years (default 0)
    - Infants: 0–2 years (default 0)
    - Seniors: 65+ years (default 0)
  - Personal preferences: `Medications / Prescriptions`, `Work Tech Kit`, `Contact Lenses / Eyewear`, `Specialized Photography`, `Formal Attire`, `Laundry Access Available`.
  - Special requirements notes (up to 500 characters).

### Feature C: Deterministic Recommendation Engine
- Pure functional module with signature:
  `generateRecommendations(config: TripConfig): RecommendedItem[]`
- Explicit Strategy-Driven Quantities:
  - `per_person`: Exactly 1 per eligible person (Toothbrush, boots, jacket).
  - `per_day`: Daily rate (Guidebook, daily trail snacks).
  - `per_person_per_day`: Wearables scaled by duration with item-specific laundry rules (underwear: 7-day laundry rotation, socks: 7-day rotation, shirts: 5-day rotation, pants: 2.5-day rotation; no arbitrary blanket 14-day cap).
  - `shared_capacity`: Group gear scaled by capacity (1 tent per 2 persons, 1 sunscreen per 3 persons / 10 days).
  - `fixed`: Constant count (universal adapter, car kit).
  - `user_defined`: Custom items or user-locked overrides.
- 12-step pipeline: Base Essentials $\rightarrow$ Transport & Dual Baggage $\rightarrow$ Climate $\rightarrow$ Accommodation $\rightarrow$ Activity $\rightarrow$ Health/Preferences $\rightarrow$ Age-specific rules $\rightarrow$ Strategy-based quantity calculation $\rightarrow$ Canonical slug deduplication $\rightarrow$ Reconciliation with dismissed items $\rightarrow$ Weight and priority assignment $\rightarrow$ Final category sorting.

### Feature D: Interactive Packing Checklist with Partial Packing
- Categories: Documents, Clothing, Toiletries, Electronics, Gear, Health, Miscellaneous.
- Explicit Triple-Quantity & Partial Packing State:
  - `generatedQuantity`: Recommendation engine output.
  - `userAdjustedQuantity`: User override (if modified).
  - `effectiveQuantity`: Effective active count (`userAdjustedQuantity ?? generatedQuantity`).
  - `packedQuantity`: Items packed so far ($0 \le \text{packedQuantity} \le \text{effectiveQuantity}$).
  - `remainingQuantity`: Calculated runtime value ($\text{effectiveQuantity} - \text{packedQuantity}$).
  - `isPacked`: Computed boolean ($\text{packedQuantity} \ge \text{effectiveQuantity} \land \text{effectiveQuantity} > 0$).
- Incremental packing controls: Single-click pack all or increment/decrement packed count.
- Inline custom item creator with user-defined priority and unit weight.
- Delete item with 5-second undo toast.
- **Critical Item Guardrail:** Deleting a `critical` item triggers a confirmation warning and places the item in a collapsible "Dismissed Essentials" drawer. It can be restored at any time.
- Search filter bar and filter chips (`All`, `Unpacked Only`, `Critical Only`).

### Feature E: Trip Management (Dashboard)
- List all saved trips with travel dates, status tags (`Upcoming`, `In Progress`, `Completed`), and visual packing progress meter.
- Action menu: Open checklist, Edit trip parameters (triggers non-destructive reconciliation), Duplicate trip (resets packed quantities), and Delete trip with confirmation modal.

### Feature F: Template Engine
- System default templates: *Weekend Getaway*, *Business Express*, *Alpine Trek*, *Beach & Island Sun*.
- User custom templates: Saved from active trips or created from scratch.

### Feature G: Readiness Score Engine
- Mathematical formula:
  $$\text{Score} = \left( \frac{\sum_{i \in \text{Packed}} W_i}{\sum_{i \in \text{All Active}} W_i} \right) \times 100$$
  where $W_{\text{critical}} = 3$, $W_{\text{recommended}} = 2$, $W_{\text{optional}} = 1$.
- Partial packing contributes proportionally to the score.
- Dismissed optional items are excluded from the denominator.
- If any critical item is unpacked or dismissed, an alert badge is displayed: *"Critical travel items remain unconfirmed!"*

### Feature H: Dual-Baggage Weight Estimator
- Reference weight database pre-assigned to all generated items.
- Derived total weight: $\text{weightGrams} \times \text{effectiveQuantity}$ computed at runtime (not independently persisted).
- Unknown weights handled explicitly with item count and disclaimer.
- Independent checks against cabin weight limit (e.g. 7kg) and checked weight limit (e.g. 23kg).

### Feature I: Local Data, Persistence & Storage Abstraction
- Clean repository contract (`ITripsRepository`, `IItemsRepository`, `ITemplatesRepository`).
- Dual implementation:
  - Primary: IndexedDB via Dexie.js.
  - Fallback: In-memory repository with clear banner when private browsing blocks IndexedDB.
- One-click JSON backup export (`packpilot-backup-YYYY-MM-DD.json`).
- Schema-validated JSON import with conflict resolution dialog.
