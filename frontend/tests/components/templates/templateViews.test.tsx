import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { TemplateCard } from '../../../src/components/templates/TemplateCard'
import { ViewTemplateModal } from '../../../src/components/templates/ViewTemplateModal'
import type { PackingTemplate } from '../../../src/types'

const mockSystemTemplate: PackingTemplate = {
  id: 'template-predefined-beach',
  name: 'Beach Vacation',
  description: 'Essential sun protection, swimwear, coastal gear, and seaside comfort for tropical and coastal trips.',
  isSystem: true,
  defaultActivities: ['beach'],
  defaultClimate: 'warm',
  defaultTransport: ['flight'],
  items: [
    {
      name: 'Swimwear / Bathing Suit',
      itemSlug: 'wear-swimwear',
      category: 'clothing',
      quantityStrategy: 'fixed',
      defaultQuantity: 2,
      priority: 'critical',
      weightGrams: 200,
      isShared: false,
      reasons: ['Beach and swimming activity'],
    },
    {
      name: 'Sunscreen SPF 50+',
      itemSlug: 'health-sunscreen',
      category: 'health',
      quantityStrategy: 'fixed',
      defaultQuantity: 1,
      priority: 'critical',
      weightGrams: 150,
      isShared: true,
      reasons: ['High UV index solar protection'],
    },
    {
      name: 'Quick-Dry Beach Towel',
      itemSlug: 'gear-beach-towel',
      category: 'gear',
      quantityStrategy: 'fixed',
      defaultQuantity: 1,
      priority: 'recommended',
      weightGrams: 300,
      isShared: false,
      reasons: ['Fast-drying microfibre towel'],
    },
  ],
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
}

const mockCustomTemplate: PackingTemplate = {
  id: 'template-custom-alpine',
  name: 'Alpine Trekking Kit',
  description: 'Handpicked ultra-light gear for mountain summit ascents.',
  isSystem: false,
  defaultClimate: 'cold',
  defaultActivities: ['trekking'],
  items: [
    {
      name: 'Trail Running Shoes',
      itemSlug: 'wear-trail-shoes',
      category: 'clothing',
      quantityStrategy: 'fixed',
      defaultQuantity: 1,
      priority: 'critical',
      weightGrams: 700,
      isShared: false,
      reasons: ['Alpine trail grip'],
    },
    {
      name: 'Custom Trekking Poles',
      itemSlug: 'custom-trekking-poles',
      category: 'gear',
      quantityStrategy: 'fixed',
      defaultQuantity: 1,
      priority: 'recommended',
      weightGrams: 450,
      isShared: false,
      reasons: ['Elevation stability'],
    },
  ],
  createdAt: '2026-11-20T12:00:00.000Z',
  updatedAt: '2026-11-20T12:00:00.000Z',
}

const mockMinimalTemplate: PackingTemplate = {
  id: 'template-minimal',
  name: 'Minimal Blank Template',
  description: '',
  isSystem: false,
  items: [
    {
      name: 'Generic Notepad',
      itemSlug: 'custom-notepad',
      category: 'miscellaneous',
      quantityStrategy: 'fixed',
      defaultQuantity: 1,
      priority: 'optional',
      isShared: false,
      reasons: [],
    },
  ],
  createdAt: '2026-11-20T12:00:00.000Z',
  updatedAt: '2026-11-20T12:00:00.000Z',
}

const mockEmptyTemplate: PackingTemplate = {
  id: 'template-empty',
  name: 'Empty Template Draft',
  description: '',
  isSystem: false,
  items: [],
  createdAt: '2026-11-20T12:00:00.000Z',
  updatedAt: '2026-11-20T12:00:00.000Z',
}

describe('TemplateCard Component', () => {
  it('renders predefined system template with system badge, item count, and immutable label', () => {
    const onViewSpy = vi.fn()
    const html = renderToString(
      <TemplateCard template={mockSystemTemplate} onView={onViewSpy} />
    )

    // Name and description
    expect(html).toContain('Beach Vacation')
    expect(html).toContain('Essential sun protection')

    // System badge & immutability indicator
    expect(html).toContain('Predefined')
    expect(html).toContain('Immutable')
    expect(html).not.toContain('Personal template')

    // Item count
    expect(html).toContain('3 items')

    // Action button
    expect(html).toContain('View Details')
  })

  it('renders custom template with custom badge and personal template indicator', () => {
    const html = renderToString(
      <TemplateCard template={mockCustomTemplate} />
    )

    expect(html).toContain('Alpine Trekking Kit')
    expect(html).toContain('Handpicked ultra-light gear')
    expect(html).toContain('Custom')
    expect(html).toContain('Personal template')
    expect(html).not.toContain('Immutable')
    expect(html).toContain('2 items')
  })

  it('renders category indicator pills for covered categories', () => {
    const html = renderToString(
      <TemplateCard template={mockSystemTemplate} />
    )

    // Should indicate covered categories: clothing, health, gear
    expect(html).toContain('Categories')
    expect(html).toContain('Clothing &amp; Apparel')
    expect(html).toContain('Health &amp; Safety')
    expect(html).toContain('Gear &amp; Equipment')
  })

  it('gracefully handles empty descriptions with placeholder text', () => {
    const html = renderToString(
      <TemplateCard template={mockMinimalTemplate} />
    )

    expect(html).toContain('Minimal Blank Template')
    expect(html).toContain('No description provided.')
    expect(html).toContain('1 item')
  })

  it('handles empty item list gracefully with 0 items count', () => {
    const html = renderToString(
      <TemplateCard template={mockEmptyTemplate} />
    )

    expect(html).toContain('Empty Template Draft')
    expect(html).toContain('0 items')
    expect(html).not.toContain('Categories')
  })
})

describe('ViewTemplateModal Component', () => {
  it('renders closed modal as empty string', () => {
    const html = renderToString(
      <ViewTemplateModal
        isOpen={false}
        onClose={vi.fn()}
        template={mockSystemTemplate}
      />
    )
    expect(html).toBe('')
  })

  it('renders null template as empty string even if open', () => {
    const html = renderToString(
      <ViewTemplateModal
        isOpen={true}
        onClose={vi.fn()}
        template={null}
      />
    )
    expect(html).toBe('')
  })

  it('renders predefined system template with prominent read-only banner', () => {
    const html = renderToString(
      <ViewTemplateModal
        isOpen={true}
        onClose={vi.fn()}
        template={mockSystemTemplate}
      />
    )

    // Modal header
    expect(html).toContain('Beach Vacation')
    expect(html).toContain('Essential sun protection')

    // Read-only system banner
    expect(html).toContain('Predefined System Template')
    expect(html).toContain('Read-Only')
    expect(html).toContain('curated built-in template')
    expect(html).not.toContain('User Created')

    // Travel context
    expect(html).toContain('Climate: warm')
    expect(html).toContain('flight')
    expect(html).toContain('beach')

    // Items count
    expect(html).toContain('3 items')
    expect(html).toContain('Close')
  })

  it('renders custom template with custom banner and metadata', () => {
    const html = renderToString(
      <ViewTemplateModal
        isOpen={true}
        onClose={vi.fn()}
        template={mockCustomTemplate}
      />
    )

    expect(html).toContain('Alpine Trekking Kit')
    expect(html).toContain('Custom Travel Template')
    expect(html).toContain('User Created')
    expect(html).not.toContain('Read-Only')
    expect(html).toContain('2 items')
  })

  it('renders items grouped by category with quantities, priorities, and weights', () => {
    const html = renderToString(
      <ViewTemplateModal
        isOpen={true}
        onClose={vi.fn()}
        template={mockSystemTemplate}
      />
    )

    // Category groupings
    expect(html).toContain('Clothing &amp; Apparel')
    expect(html).toContain('Health &amp; Safety')
    expect(html).toContain('Gear &amp; Equipment')

    // Item details
    expect(html).toContain('Swimwear / Bathing Suit')
    expect(html).toContain('×2')
    expect(html).toContain('Critical')
    expect(html).toContain('200 g')

    expect(html).toContain('Sunscreen SPF 50+')
    expect(html).toContain('×1')
    expect(html).toContain('150 g')
    expect(html).toContain('Shared')

    expect(html).toContain('Quick-Dry Beach Towel')
    expect(html).toContain('Recommended')
    expect(html).toContain('300 g')
  })

  it('gracefully handles missing weights, empty reasons, and missing description', () => {
    const html = renderToString(
      <ViewTemplateModal
        isOpen={true}
        onClose={vi.fn()}
        template={mockMinimalTemplate}
      />
    )

    expect(html).toContain('Minimal Blank Template')
    expect(html).toContain('No description provided.')
    expect(html).toContain('Generic Notepad')
    expect(html).toContain('×1')
    expect(html).toContain('Optional')

    // No weight badge rendered
    expect(html).not.toContain('g</span>')
    expect(html).not.toContain('kg</span>')
    expect(html).not.toContain('Shared')
  })

  it('renders clear empty state when template contains no items', () => {
    const html = renderToString(
      <ViewTemplateModal
        isOpen={true}
        onClose={vi.fn()}
        template={mockEmptyTemplate}
      />
    )

    expect(html).toContain('Empty Template Draft')
    expect(html).toContain('0 items')
    expect(html).toContain('No items in this template')
    expect(html).toContain('This template does not have any items saved yet.')
  })

  it('supports modal accessibility attributes and close button', () => {
    const html = renderToString(
      <ViewTemplateModal
        isOpen={true}
        onClose={vi.fn()}
        template={mockCustomTemplate}
      />
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="modal-title"')
    expect(html).toContain('Close dialog')
    expect(html).toContain('Close')
  })
})
