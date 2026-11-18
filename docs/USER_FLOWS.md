# PackPilot — Complete User Flows & Journey Maps

**Document Reference:** UFD-PACKPILOT-V1  
**Version:** 1.0.0  
**Status:** Approved  

---

## 1. Flow Overview & Global Sitemap

The PackPilot experience is organized around six interconnected core user flows, optimized for zero friction, high speed, and complete privacy:

```mermaid
graph TD
    A[Home / Landing Page] -->|Click 'Plan a New Trip'| B[Trip Creation Wizard]
    A -->|Click 'Explore Templates'| C[Templates Library]
    A -->|Click 'My Trips'| D[Trip Dashboard]
    
    B -->|Complete Step 5| E[Generated Packing Checklist]
    C -->|Select 'Use Template'| B2[Pre-filled Wizard]
    B2 --> E
    
    D -->|Click Trip Card| E
    D -->|Click 'New Trip'| B
    
    E -->|Manage Checklist| E1[Check/Uncheck Items]
    E -->|Add Custom Item| E2[Inline Custom Item Modal]
    E -->|Save as Template| C1[Custom Template Stored]
    E -->|Edit Trip Parameters| B3[Edit Trip Modal]
    
    D -->|Settings & Backup| F[Backup & Restore Hub]
    F -->|Export JSON| F1[Download Local Backup]
    F -->|Import JSON| F2[Validate & Merge/Restore]
```

---

## 2. User Flow 1: First-Time User Experience (Onboarding & First Trip)

```mermaid
sequenceDiagram
    autonumber
    actor User as Traveller
    participant Web as Landing Page
    participant Wiz as Trip Wizard
    participant Eng as Recommendation Engine
    participant DB as IndexedDB (Dexie)
    participant View as Checklist View

    User->>Web: Visits PackPilot website
    Web-->>User: Renders Travel Scrapbook Hero & Feature highlights
    User->>Web: Clicks "Plan a New Trip"
    Web->>Wiz: Navigates to /wizard/new
    
    rect rgb(255, 249, 239)
        Note over User,Wiz: Step 1: Core Trip Basics
        User->>Wiz: Enters "Amalfi Coast Holiday", "Italy", Dates: June 10 - June 17
        Wiz->>Wiz: Validates dates (7 days duration)
        User->>Wiz: Clicks "Next: Transport"
        
        Note over User,Wiz: Step 2: Transport
        User->>Wiz: Selects [Flight, Train]
        User->>Wiz: Clicks "Next: Activities"
        
        Note over User,Wiz: Step 3: Activities
        User->>Wiz: Selects [Beach, Sightseeing, Relaxation]
        User->>Wiz: Clicks "Next: Climate"
        
        Note over User,Wiz: Step 4: Weather & Climate
        User->>Wiz: Selects [Warm]
        User->>Wiz: Clicks "Next: Preferences"
        
        Note over User,Wiz: Step 5: Preferences & Companions
        User->>Wiz: Enters 2 travellers, selects [Medications, Photography]
        User->>Wiz: Clicks "Generate My Checklist"
    end
    
    Wiz->>Eng: Passes TripConfig to runRecommendationEngine()
    Eng->>Eng: Computes duration (8 days), applies rules, calculates quantities, deduplicates
    Eng-->>Wiz: Returns 38 categorized, prioritized items with rationale
    Wiz->>DB: Saves Trip Record + Packing Items in atomic transaction
    DB-->>Wiz: Success (Trip ID: trip_982b)
    Wiz->>View: Redirects to /trips/trip_982b
    View-->>User: Displays Scrapbook Packing Checklist with Readiness Score & Weight
```

---

## 3. User Flow 2: Active Packing & Checklist Interaction

```mermaid
flowchart TD
    Start[User opens /trips/:id] --> Load[Load Trip & Items from IndexedDB]
    Load --> Render[Render Categories & Readiness Meter]
    
    Render --> Action{User Action}
    
    Action -->|Toggle Item Checkbox| Toggle[Flip isPacked state in memory]
    Toggle --> UpdateDB[Debounced Save to IndexedDB]
    Toggle --> RecalcScore[Recalculate Weighted Readiness Score]
    RecalcScore --> CheckCritical{Any Critical Items Unpacked?}
    CheckCritical -->|Yes| ShowAlert[Display Critical Items Callout Banner]
    CheckCritical -->|No| Check100{Score == 100%?}
    Check100 -->|Yes| ShowStamp[Display 'Ready for Adventure' Passport Stamp]
    Check100 -->|No| Render
    ShowAlert --> Render
    ShowStamp --> Render
    
    Action -->|Change Quantity| AdjQty[Increase/Decrease item.quantity]
    AdjQty --> RecalcWgt[Recalculate Estimated Luggage Weight]
    RecalcWgt --> UpdateDB
    
    Action -->|Filter Items| Filter[Click 'Unpacked Only' or 'Critical Only']
    Filter --> FilterList[Filter displayed items in UI state]
    FilterList --> Render
    
    Action -->|Search| Search[Type in search input]
    Search --> SearchList[Instant client-side substring match]
    SearchList --> Render
```

---

## 4. User Flow 3: Template-to-Trip Creation

```mermaid
sequenceDiagram
    autonumber
    actor User as Traveller
    participant Lib as Templates View
    participant Wiz as Wizard Pre-fill
    participant DB as IndexedDB
    participant List as Checklist View

    User->>Lib: Visits /templates
    Lib-->>User: Shows curated cards (Alpine Trek, Business Express, Weekend Getaway)
    User->>Lib: Clicks "Preview" on "Alpine Trek"
    Lib-->>User: Displays modal with 25 curated trekking items
    User->>Lib: Clicks "Use Template"
    Lib->>Wiz: Navigates to /wizard/new?templateId=tpl_alpine_trek
    Wiz-->>User: Form pre-filled with Trekking, Camping, Cold climate, Essential gear
    User->>Wiz: Customizes Destination ("Swiss Alps") and Dates (Oct 1 - Oct 5)
    User->>Wiz: Clicks "Create Trip"
    Wiz->>DB: Stores customized trip and template-derived items
    Wiz->>List: Navigates to /trips/:id
```

---

## 5. User Flow 4: Trip Edit & Smart Parameter Recalculation

A frequent real-world scenario is when a traveller extends their trip or changes activities *after* already checking off half their items. PackPilot handles this via an intelligent non-destructive update algorithm:

```mermaid
flowchart TD
    A[User clicks 'Edit Trip Parameters'] --> B[Open Modal with existing trip data]
    B --> C[User extends trip from 4 days to 8 days & adds 'Trekking']
    C --> D[User clicks 'Update & Re-evaluate Checklist']
    D --> E[Recommendation Engine computes new ideal item set]
    
    E --> F[Diffing & Smart Merge Engine]
    F --> G{Item already exists in checklist?}
    G -->|Yes, already packed| H[Preserve isPacked = true, update recommended quantity]
    G -->|Yes, unpacked| I[Update quantity & append new rule reasons]
    G -->|No, brand new item| J[Insert as new item with isPacked = false]
    G -->|Custom item added by user| K[Preserve untouched!]
    
    H --> L[Commit merged items to IndexedDB]
    I --> L
    J --> L
    K --> L
    L --> M[Present summary toast: 'Checklist updated: 6 items added/adjusted']
```

---

## 6. User Flow 5: Data Backup, Device Migration & Restoration

```mermaid
sequenceDiagram
    autonumber
    actor User as Traveller
    participant Hub as Settings / Backup Page
    participant Service as BackupService
    participant DB as IndexedDB
    participant Disk as Local File System

    rect rgb(245, 235, 221)
        Note over User,Disk: Flow 5A: Exporting Backup
        User->>Hub: Clicks "Download JSON Backup"
        Hub->>Service: exportDatabase()
        Service->>DB: Queries all trips, items, templates, and settings
        DB-->>Service: Complete data payload
        Service->>Service: Generates schema-versioned JSON string with metadata
        Service->>Disk: Triggers download: packpilot-backup-2026-11-18.json
        Hub-->>User: Toast: "Backup successfully exported!"
    end

    rect rgb(255, 249, 239)
        Note over User,Disk: Flow 5B: Importing on New Device / Browser
        User->>Hub: Uploads packpilot-backup-2026-11-18.json
        Hub->>Service: importDatabase(file)
        Service->>Service: Validates JSON format & schema version
        alt Corrupted or Invalid JSON
            Service-->>Hub: Error: "Invalid backup format or corrupted file"
            Hub-->>User: Displays error alert with guidance
        else Valid Backup
            Service-->>Hub: Displays preview modal: "Found 4 trips, 128 items, 2 custom templates"
            User->>Hub: Selects resolution: "Merge with existing data"
            Hub->>DB: Executes transactional merge
            DB-->>Hub: Transaction successful
            Hub-->>User: Toast: "Data restored successfully! 4 trips imported."
        end
    end
```
