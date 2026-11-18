# PackPilot — Design System Specification

**Design Identity:** Travel Scrapbook + Adventure Editorial  
**Document Reference:** DSS-PACKPILOT-V1  
**Version:** 1.0.0  
**Status:** Approved & Implemented in Codebase  

---

## 1. Visual Identity & Creative Direction

PackPilot blends the nostalgia and tactile romance of a well-worn **Travel Scrapbook** with the typographic elegance and structured hierarchy of a high-end **Adventure Editorial Journal**.

```mermaid
graph LR
    subgraph Creative_Pillars [Design Identity Pillars]
        P1[Tactile Paper Aesthetic]
        P2[Editorial Serifs & Clean Sans]
        P3[Travel Memorabilia Motifs]
        P4[Modern Usability & Accessibility]
    end

    P1 -->|Warm Paper Cream #F5EBDD & Warm White #FFF9EF| UI[PackPilot UI]
    P2 -->|Playfair Display & DM Sans| UI
    P3 -->|Polaroids, Travel Tickets, Passport Stamps, Tape| UI
    P4 -->|WCAG AA Contrast, 44px Touch Targets, Zero Clutter| UI
```

---

## 2. Color Palette & Semantic Tokens

| Color Name | Hex Code | Swatch | Semantic Application |
| :--- | :--- | :---: | :--- |
| **Warm Paper Cream** | `#F5EBDD` | ![#F5EBDD](https://placehold.co/24x24/F5EBDD/F5EBDD.png) | Base application canvas background. |
| **Warm White** | `#FFF9EF` | ![#FFF9EF](https://placehold.co/24x24/FFF9EF/FFF9EF.png) | Cards, sheets, modals, elevated surfaces. |
| **Terracotta** | `#B85C38` | ![#B85C38](https://placehold.co/24x24/B85C38/B85C38.png) | Primary action CTAs, critical badges, brand marks. |
| **Dark Terracotta** | `#8F3F26` | ![#8F3F26](https://placehold.co/24x24/8F3F26/8F3F26.png) | Hover states, active buttons, high-contrast borders. |
| **Sunshine Yellow** | `#E6B94F` | ![#E6B94F](https://placehold.co/24x24/E6B94F/E6B94F.png) | Attention highlights, stars, luggage warnings. |
| **Ink Black** | `#24221F` | ![#24221F](https://placehold.co/24x24/24221F/24221F.png) | Editorial typography, deep icons, stamp borders. |
| **Sand** | `#A7A18F` | ![#A7A18F](https://placehold.co/24x24/A7A18F/A7A18F.png) | Dividers, dashed ticket lines, muted borders. |
| **Forest Green** | `#244C3B` | ![#244C3B](https://placehold.co/24x24/244C3B/244C3B.png) | Nature/outdoor accents, readiness complete status. |

---

## 3. Typography Hierarchy

### 3.1 Font Families
- **Editorial Headings:** `Playfair Display`, Georgia, Cambria, serif.
- **Body & Functional UI:** `DM Sans`, system-ui, -apple-system, sans-serif.
- **Monospace & Metadata:** `ui-monospace`, SFMono-Regular, Menlo, monospace.

### 3.2 Type Scale
```css
/* Editorial Headings (Playfair Display) */
.heading-hero     { font-family: var(--font-heading); font-size: 3.25rem; font-weight: 800; line-height: 1.1; }
.heading-section  { font-family: var(--font-heading); font-size: 2.00rem; font-weight: 700; line-height: 1.2; }
.heading-card     { font-family: var(--font-heading); font-size: 1.25rem; font-weight: 600; line-height: 1.3; }

/* Functional UI (DM Sans) */
.body-large       { font-family: var(--font-body); font-size: 1.125rem; line-height: 1.6; }
.body-base        { font-family: var(--font-body); font-size: 1.000rem; line-height: 1.5; }
.body-small       { font-family: var(--font-body); font-size: 0.875rem; line-height: 1.4; }
.caption          { font-family: var(--font-body); font-size: 0.750rem; letter-spacing: 0.05em; text-transform: uppercase; }
```

---

## 4. Memorabilia Motifs & Decorative Accents

### 4.1 Polaroid Photo Card
- Crisp warm-white photo frame with a wide bottom margin for captions.
- Elevated with a soft ambient shadow (`--shadow-polaroid`) and a subtle $-0.5^{\circ}$ organic rotation on hover.

### 4.2 Washi Tape Overlay (`.scrapbook-tape`)
- Translucent parchment tape element attached at the top-center of cards with semi-transparent borders and subtle rotation ($1^{\circ}$).

### 4.3 Travel Ticket Container (`.ticket-card`)
- Rounded corners (`rounded-ticket: 12px`) with a dashed perimeter border in Sand (`border-sand/70`), reminiscent of vintage train or airline boarding passes.

### 4.4 Passport Stamp Badge (`.btn-stamp` / `Badge[variant="stamp"]`)
- Hard drop shadow (`box-shadow: 2px 2px 0 0 #24221F`), thick 2px solid Ink Black border, and uppercase tracked typography imitating physical rubber stamps.

---

## 5. UI Component Library Architecture

### 5.1 Button Component (`src/components/ui/Button.tsx`)
```typescript
export type ButtonVariant =
  | 'primary'        // Terracotta background, Warm White text
  | 'secondary'      // Warm White background, Sand border, Ink Black text
  | 'forest'         // Forest Green background (Success, Outdoors)
  | 'sunshine'       // Sunshine Yellow background (Highlights)
  | 'outline'        // Transparent with Ink Black 2px border
  | 'stamp'          // Stamped scrapbook button with hard 2px offset shadow
  | 'ghost'          // Borderless with subtle hover background
  | 'terracottaDark' // Deep Terracotta for intense contrast
```

### 5.2 Card Component (`src/components/ui/Card.tsx`)
- Variants: `scrapbook` (standard card), `polaroid` (photo frame), `ticket` (dashed boarding pass), `flat` (simple border).
- Supports `hasTape` boolean prop to display washi tape on top.

### 5.3 Badge Component (`src/components/ui/Badge.tsx`)
- Variants: `terracotta`, `forest`, `sunshine`, `sand`, `stamp`, `outline`.
- Supports optional leading icon.

---

## 6. Accessibility & Responsiveness Principles

1. **Color Contrast:** All body text in Ink Black (`#24221F`) on Warm Paper Cream (`#F5EBDD`) yields a contrast ratio of **12.8:1**, comfortably exceeding the WCAG AAA requirement (7:1).
2. **Keyboard Navigation:** All interactive elements feature visible, high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-terracotta`).
3. **Touch Targets:** Minimum button and checkbox hit targets of 44px $\times$ 44px on mobile devices.
4. **Motion Sensitivity:** All rotations and transforms respect `prefers-reduced-motion` media queries.
