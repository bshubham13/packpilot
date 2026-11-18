# PackPilot — Architecture Decision Records (ADRs)

**Document Reference:** ADR-PACKPILOT-V1  
**Version:** 1.4.0 (Final Milestone 1 Refinement)  
**Status:** Implementation Ready (Awaiting Final PO Approval)  

---

## Index of Architectural Decisions

- **ADR-001:** Client-Side IndexedDB (Dexie.js) with Explicit In-Memory Probe Fallback
- **ADR-002:** Deterministic Rule Engine vs External LLM / Generative AI
- **ADR-003:** HashRouter vs BrowserRouter for GitHub Pages Static Deployment
- **ADR-004:** Zustand Store Separation vs Redux Toolkit vs React Context
- **ADR-005:** Tailwind CSS 4 + CSS Design Tokens vs CSS Modules / CSS-in-JS
- **ADR-006:** Non-Destructive Smart Merge for Checklist Modifications
- **ADR-007:** Weighted Readiness Scoring & Critical Item Deletion Guardrails *(PO Approved)*
- **ADR-008:** Baseline Reference Weights with Dual Baggage Thresholds *(Revised)*
- **ADR-009:** Gender-Neutral Preference Architecture vs Demographic Stereotyping
- **ADR-010:** Schema-Versioned JSON Export/Import vs Opaque Binary Snapshots
- **ADR-011:** Accommodation-Specific Rules in Recommendation Pipeline
- **ADR-012:** "Zombie Item" Prevention via `dismissedItems` Snapshot Tracking
- **ADR-013:** Multi-Traveller Master Checklist & Contiguous Age Boundaries *(Revised)*
- **ADR-014:** Item-Specific Strategy-Driven Quantity & Laundry Architecture *(Revised)*
- **ADR-015:** Storage Repository Contract & In-Memory Fallback Abstraction
- **ADR-016:** Partial Packing State & Derived Runtime Weight Modeling *(New)*

---

### ADR-001: Client-Side IndexedDB (Dexie.js) with Explicit In-Memory Probe Fallback

#### Context
PackPilot requires reliable, structured data persistence across sessions for trips, checklists, templates, and user preferences. However, certain browser environments (e.g. restrictive private/incognito browsing, corrupted profiles, quota limits) block IndexedDB.

#### Decision
Use **IndexedDB via Dexie.js** as the primary persistence layer. At application boot, execute an asynchronous health probe `probeIndexedDB()`. If unavailable, set `isStorageAvailable = false`, route persistence calls solely to in-memory Zustand stores, and display a persistent informational banner warning users that changes will not persist across tab restarts unless exported as JSON.

---

### ADR-002: Deterministic Rule Engine vs External LLM / Generative AI

#### Context
Core value proposition requires intelligent, personalized packing recommendations without network latency, API costs, or AI hallucinations.

#### Decision
Implement a **Pure TypeScript Deterministic Rule Engine** organized into a modular 12-step pipeline.

---

### ADR-003: HashRouter vs BrowserRouter for GitHub Pages Static Deployment

#### Context
GitHub Pages is a static host returning 404 HTTP status for unknown client-side routes.

#### Decision
Adopt **React Router `HashRouter`** (`/#/trips/:id`).

---

### ADR-004: Zustand Store Separation vs Redux Toolkit vs React Context

#### Context
Application manages multi-entity state (trips, active checklist, templates, settings) with frequent re-renders.

#### Decision
Deploy four domain-bounded Zustand stores: `useTripStore`, `useChecklistStore`, `useTemplateStore`, `useSettingsStore`.

---

### ADR-005: Tailwind CSS 4 + CSS Design Tokens vs CSS Modules

#### Context
The approved design direction (*Travel Scrapbook + Adventure Editorial*) requires custom paper cream tokens, vintage shadows, and tactile styling.

#### Decision
Combine **Tailwind CSS 4 (`@tailwindcss/vite`)** with **CSS custom properties** (`:root`) and TypeScript token constants.

---

### ADR-006: Non-Destructive Smart Merge for Checklist Modifications

#### Context
Modifying trip parameters (extending dates, adding activities) on an active trip must not overwrite or uncheck items already packed by the user.

#### Decision
Implement a **Diffing & Non-Destructive Reconciliation Engine** (`mergeChecklists`) keyed by canonical `itemSlug`. Items already marked packed retain `isPacked = true`. Recommended quantities scale upwards if required. Custom items (`isCustom: true`) are never touched.

---

### ADR-007: Weighted Readiness Scoring & Critical Item Deletion Guardrails (PO APPROVED)

#### Context & Status
Approved by Product Owner on 2026-11-18 (Option A).

#### Decision
1. **Mathematical Scoring Formula:**
   $$\text{Score} = \left( \frac{\sum_{i \in \text{Packed}} W_i}{\sum_{i \in \text{All Active}} W_i} \right) \times 100$$
   where $W_{\text{critical}} = 3$, $W_{\text{recommended}} = 2$, $W_{\text{optional}} = 1$.
2. **Optional Items Exemption:** Intentionally skipped optional items are excluded from the denominator so minimalists can achieve 100% readiness.
3. **Critical Item Deletion Guardrail:**
   - Attempting to delete a `critical` item triggers an explicit confirmation warning modal: *"This item is flagged as a Critical Travel Essential. Are you sure you want to remove it?"*
   - Dismissed critical items move to a collapsible **"Dismissed Essentials"** drawer and can be restored at any time.
   - **Safety Guarantee:** Dismissing critical items **never silently produces a misleading 100% readiness score**. The UI displays an outstanding critical alert badge (*"1 critical essential was dismissed"*), maintaining PackPilot's safety promise.

---

### ADR-008: Baseline Reference Weights with Dual Baggage Thresholds (Revised)

#### Context
A traveller often carries both cabin baggage and checked baggage on the same trip. Applying a single arbitrary limit or forcing users to choose only one creates inaccurate weight tracking.

#### Decision
1. Support **Dual Baggage Modeling**:
   - `hasCabinBaggage: boolean` (default: true) & `cabinWeightLimitKg: number` (presets: 7kg, 8kg, 10kg, custom).
   - `hasCheckedBaggage: boolean` (default: false) & `checkedWeightLimitKg: number` (presets: 20kg, 23kg, 32kg, custom).
2. Distinguish the two limits in calculations and alerts.
3. Explicitly catalog items with unknown weight and display an informational disclaimer.

---

### ADR-009: Gender-Neutral Preference Architecture vs Demographic Stereotyping

#### Context
Binary gender assumptions lead to irrelevant or offensive packing recommendations.

#### Decision
Eliminate mandatory gender inputs. Personal care, hygiene, and grooming items are selected via explicit, user-controlled checkboxes in the preferences step.

---

### ADR-010: Schema-Versioned JSON Export/Import vs Opaque Binary Snapshots

#### Context
Local-first apps require a robust backup mechanism so users can safeguard their data against browser cache evictions or migrate across devices.

#### Decision
Use a human-readable, schema-versioned JSON format (`packpilot-backup-YYYY-MM-DD.json`) with top-level metadata (`schemaVersion: 1`, `exportDate`, `appVersion`).

---

### ADR-011: Accommodation-Specific Rules in Recommendation Pipeline

#### Context
Wizard Step 5 captures accommodation type (`hotel`, `hostel`, `rental`, `camping`, `friends_family`).

#### Decision
Integrate dedicated accommodation rules into Step 6 of the engine: Hostels trigger combination padlocks and dorm earplugs; hotels suppress redundant heavy bath towels; rentals inject travel multi-plugs and detergent pods.

---

### ADR-012: "Zombie Item" Prevention via `dismissedItems` Snapshot Tracking

#### Context
When users edit trip parameters after deleting an unneeded generated recommendation, naive diffing sees the item is absent and resurrects it as a new item.

#### Decision
Store full item snapshots in `trip.dismissedItems: DismissedItemRecord[]`. The reconciliation engine cross-references this array and permanently blocks deleted slugs from resurrection across all subsequent trip edits, while preserving the full snapshot for one-click restoration.

---

### ADR-013: Multi-Traveller Master Checklist & Contiguous Age Boundaries (Revised)

#### Context
Traveller composition must support all life stages without gaps, overlaps, or confusing definitions.

#### Decision
1. Define contiguous, non-overlapping age groups:
   - Infants: 0–2 years
   - Children: 3–12 years
   - Teens: 13–17 years
   - Adults: 18–64 years
   - Seniors: 65+ years
2. In V1, aggregate into a consolidated master checklist. Teens receive adult clothing quantities and dedicated tech charging rules; infants receive diaper/wipes rules based on exact count.

---

### ADR-014: Item-Specific Strategy-Driven Quantity & Laundry Architecture (Revised)

#### Context
A blanket universal cap (e.g. 14 days) distorts items with different usage patterns. Toothpaste lasts 14 days; a rain jacket is 1 per person forever; underwear needs rotation every 7 days if laundry is available.

#### Decision
Every recommendation rule explicitly defines a `QuantityStrategy` (`per_person`, `per_day`, `per_person_per_day`, `shared_capacity`, `fixed`, `user_defined`) and item-specific `laundryRotationDays` and `noLaundryMaxCap`. Arbitrary blanket caps are eliminated.

---

### ADR-015: Storage Repository Contract & In-Memory Fallback Abstraction

#### Context
Directly coupling business logic and state stores to Dexie.js makes testing difficult and crashes the application when IndexedDB is blocked in private browsing modes.

#### Decision
Introduce a decoupled repository contract (`ITripsRepository`, `IItemsRepository`, `ITemplatesRepository`) with dual implementations (`Dexie` vs `Memory`) selected via `createRepositories(isStorageAvailable)`.

---

### ADR-016: Partial Packing State & Derived Runtime Weight Modeling (New)

#### Context
Users pack gradually, not all at once. An item with quantity 5 might have 3 pairs packed today and 2 tomorrow. Furthermore, storing total weight as a persistent field risks stale/inconsistent data when quantities change.

#### Decision
1. Track partial packing on `PackingItem`:
   - `packedQuantity: number` ($0 \le \text{packedQuantity} \le \text{effectiveQuantity}$)
   - `remainingQuantity = effectiveQuantity - packedQuantity`
   - `isPacked = (packedQuantity >= effectiveQuantity && effectiveQuantity > 0)`
   - When required quantity decreases below `packedQuantity`, `packedQuantity` clamps cleanly: $\min(\text{packedQuantity}, \text{effectiveQuantity})$.
2. `totalWeightGrams` is **never persisted in database records**. It is strictly derived at runtime via $\text{weightGrams} \times \text{effectiveQuantity}$. Unknown weights remain explicitly `undefined`.
