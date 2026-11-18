/**
 * PackPilot Official Design System Tokens
 * Aesthetic: Travel Scrapbook + Adventure Editorial
 */

export const COLORS = {
  // Brand Palette
  warmCream: '#F5EBDD',     // Warm paper cream (canvas background)
  warmWhite: '#FFF9EF',     // Warm white (card & surface background)
  terracotta: '#B85C38',    // Terracotta (primary brand accent & CTA)
  terracottaDark: '#8F3F26',// Dark terracotta (hover, focus, deep emphasis)
  sunshineYellow: '#E6B94F',// Sunshine yellow (highlights, stars, tags)
  inkBlack: '#24221F',      // Ink black (primary typography & strong borders)
  sand: '#A7A18F',          // Sand (borders, muted accents, secondary lines)
  forestGreen: '#244C3B',   // Forest green (adventure accents, nature, success)

  // Functional & Semantic Mappings
  canvas: '#F5EBDD',
  surface: '#FFF9EF',
  textPrimary: '#24221F',
  textMuted: '#686259',
  borderLight: 'rgba(167, 161, 143, 0.45)',
  borderStrong: '#24221F',
} as const

export const FONTS = {
  heading: '"Playfair Display", Georgia, Cambria, "Times New Roman", Times, serif',
  body: '"DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const

export const SHADOWS = {
  scrapbook: '2px 4px 12px 0px rgba(36, 34, 31, 0.08)',
  card: '0 4px 20px -2px rgba(36, 34, 31, 0.08), 0 2px 6px -1px rgba(36, 34, 31, 0.04)',
  polaroid: '0 8px 24px -4px rgba(36, 34, 31, 0.12), 0 2px 6px -1px rgba(36, 34, 31, 0.08)',
  stamp: '0 2px 0 0 #24221F',
  float: '0 12px 32px -4px rgba(36, 34, 31, 0.15)',
} as const

export const RADII = {
  scrapbook: '4px',
  card: '8px',
  ticket: '12px',
  pill: '9999px',
} as const

export const SPACING_CONVENTIONS = {
  sectionPadding: 'py-12 md:py-20 lg:py-28',
  containerMaxWidth: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  cardPadding: 'p-6 md:p-8',
} as const

export default {
  COLORS,
  FONTS,
  SHADOWS,
  RADII,
  SPACING_CONVENTIONS,
}
