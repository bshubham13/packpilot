/**
 * PackPilot — Pure Zustand Template Store
 * Milestone 9A: Predefined system templates and custom user template management.
 * Persists all template mutations via the storage repository abstraction (Dexie / Memory).
 */

import { create } from 'zustand'
import type {
  PackingTemplate,
  TemplateItemConfig,
  PackingItem,
  PackingCategory,
  ItemPriority,
  QuantityStrategy,
} from '../types'
import { getStorageContext } from '../db/factory'
import { generateUUID } from '../utils/uuid'
import { PREDEFINED_TEMPLATES } from '../data/predefinedTemplates'

export const VALID_CATEGORIES = new Set<PackingCategory>([
  'documents',
  'clothing',
  'toiletries',
  'electronics',
  'gear',
  'health',
  'miscellaneous',
])

export const VALID_PRIORITIES = new Set<ItemPriority>([
  'critical',
  'recommended',
  'optional',
])

export const VALID_STRATEGIES = new Set<QuantityStrategy>([
  'per_person',
  'per_day',
  'per_person_per_day',
  'shared_capacity',
  'fixed',
  'user_defined',
])

export function validateTemplateItem(item: unknown, index = 0): TemplateItemConfig {
  if (!item || typeof item !== 'object') {
    throw new Error(`Invalid template item at index ${index}: item must be an object`)
  }

  const raw = item as Record<string, unknown>

  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    throw new Error(`Invalid template item at index ${index}: name is required`)
  }

  if (typeof raw.itemSlug !== 'string' || !raw.itemSlug.trim()) {
    throw new Error(`Invalid template item at index ${index}: itemSlug is required`)
  }

  if (typeof raw.category !== 'string' || !VALID_CATEGORIES.has(raw.category as PackingCategory)) {
    throw new Error(`Invalid template item at index ${index}: category '${String(raw.category)}' is invalid`)
  }

  if (typeof raw.priority !== 'string' || !VALID_PRIORITIES.has(raw.priority as ItemPriority)) {
    throw new Error(`Invalid template item at index ${index}: priority '${String(raw.priority)}' is invalid`)
  }

  const defaultQty = raw.defaultQuantity
  if (
    typeof defaultQty !== 'number' ||
    !Number.isInteger(defaultQty) ||
    defaultQty < 1
  ) {
    throw new Error(`Invalid template item at index ${index}: defaultQuantity must be a positive integer (>= 1)`)
  }

  const strategy = raw.quantityStrategy ?? 'fixed'
  if (typeof strategy !== 'string' || !VALID_STRATEGIES.has(strategy as QuantityStrategy)) {
    throw new Error(`Invalid template item at index ${index}: quantityStrategy '${String(strategy)}' is invalid`)
  }

  if (raw.weightGrams !== undefined && raw.weightGrams !== null) {
    if (typeof raw.weightGrams !== 'number' || !Number.isFinite(raw.weightGrams) || raw.weightGrams < 0) {
      throw new Error(`Invalid template item at index ${index}: weightGrams must be a non-negative finite number`)
    }
  }

  if (raw.reasons !== undefined && (!Array.isArray(raw.reasons) || !raw.reasons.every((r) => typeof r === 'string'))) {
    throw new Error(`Invalid template item at index ${index}: reasons must be an array of strings`)
  }

  return {
    name: raw.name.trim(),
    itemSlug: raw.itemSlug.trim(),
    category: raw.category as PackingCategory,
    priority: raw.priority as ItemPriority,
    quantityStrategy: strategy as QuantityStrategy,
    quantityParams: raw.quantityParams as TemplateItemConfig['quantityParams'],
    defaultQuantity: defaultQty,
    weightGrams: raw.weightGrams !== undefined && raw.weightGrams !== null ? Math.round(raw.weightGrams as number) : undefined,
    isShared: Boolean(raw.isShared),
    reasons: Array.isArray(raw.reasons) ? [...raw.reasons] : [],
  }
}

export interface CreateTemplateFromTripOptions {
  tripId: string
  name: string
  description?: string
  items?: PackingItem[]
}

export interface TemplateState {
  templates: PackingTemplate[]
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  loadTemplates: () => Promise<PackingTemplate[]>
  createTemplateFromTrip: (
    tripIdOrOptions: string | CreateTemplateFromTripOptions,
    name?: string,
    description?: string,
    items?: PackingItem[]
  ) => Promise<PackingTemplate>
  updateTemplate: (
    id: string,
    updates: Partial<Pick<PackingTemplate, 'name' | 'description' | 'items' | 'defaultTransport' | 'defaultActivities' | 'defaultClimate' | 'defaultAccommodation'>>
  ) => Promise<PackingTemplate>
  deleteTemplate: (id: string) => Promise<void>
  getTemplateById: (id: string) => PackingTemplate | undefined
  clearError: () => void
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  isLoading: false,
  isInitialized: false,
  error: null,

  loadTemplates: async () => {
    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      const existingTemplates = await storage.templates.getAllTemplates()
      const existingIds = new Set(existingTemplates.map((t) => t.id))

      // Identify missing system templates to seed (first run or missing entries)
      const missingSystemTemplates = PREDEFINED_TEMPLATES.filter((sys) => !existingIds.has(sys.id))

      if (missingSystemTemplates.length > 0) {
        for (const templateToSeed of missingSystemTemplates) {
          await storage.templates.saveTemplate(templateToSeed)
        }
      }

      // Re-query storage to obtain the definitive list of templates
      const allTemplates = await storage.templates.getAllTemplates()

      // Sort system templates first (in PREDEFINED_TEMPLATES declaration order),
      // followed by custom user templates in descending chronological order
      const systemOrderMap = new Map<string, number>(PREDEFINED_TEMPLATES.map((t, idx) => [t.id, idx]))
      allTemplates.sort((a, b) => {
        if (a.isSystem && b.isSystem) {
          return (systemOrderMap.get(a.id) ?? 0) - (systemOrderMap.get(b.id) ?? 0)
        }
        if (a.isSystem && !b.isSystem) return -1
        if (!a.isSystem && b.isSystem) return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      set({
        templates: allTemplates,
        isLoading: false,
        isInitialized: true,
        error: null,
      })

      return allTemplates
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load packing templates'
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  createTemplateFromTrip: async (
    tripIdOrOptions: string | CreateTemplateFromTripOptions,
    nameArg?: string,
    descriptionArg?: string,
    itemsArg?: PackingItem[]
  ) => {
    let tripId: string
    let name: string
    let description = ''
    let itemsOverride: PackingItem[] | undefined

    if (typeof tripIdOrOptions === 'object') {
      tripId = tripIdOrOptions.tripId
      name = tripIdOrOptions.name
      description = tripIdOrOptions.description || ''
      itemsOverride = tripIdOrOptions.items
    } else {
      tripId = tripIdOrOptions
      name = nameArg || ''
      description = descriptionArg || ''
      itemsOverride = itemsArg
    }

    if (!tripId || !tripId.trim()) {
      throw new Error('Trip ID is required to create a template')
    }
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Template name is required')
    }
    if (trimmedName.length > 60) {
      throw new Error('Template name cannot exceed 60 characters')
    }
    const trimmedDescription = description.trim()
    if (trimmedDescription.length > 200) {
      throw new Error('Template description cannot exceed 200 characters')
    }

    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()

      // 1. Fetch trip metadata for context defaults
      const trip = await storage.trips.getTripById(tripId)

      // 2. Fetch items if not directly provided
      const rawItems = itemsOverride ?? (await storage.items.getItemsForTrip(tripId))

      // 3. Map items to TemplateItemConfig (filter out items with effectiveQuantity <= 0)
      const templateItems: TemplateItemConfig[] = rawItems
        .filter((item) => (item.effectiveQuantity ?? item.generatedQuantity) > 0)
        .map((item) => ({
          name: item.name,
          itemSlug: item.itemSlug,
          category: item.category,
          quantityStrategy: item.quantityStrategy || 'fixed',
          quantityParams: item.quantityParams,
          defaultQuantity: item.effectiveQuantity ?? item.generatedQuantity ?? 1,
          priority: item.priority,
          weightGrams: item.weightGrams,
          isShared: item.isShared ?? false,
          reasons: item.reasons && item.reasons.length > 0 ? [...item.reasons] : ['Saved from trip checklist'],
        }))

      const now = new Date().toISOString()
      const newTemplate: PackingTemplate = {
        id: `template-${generateUUID()}`,
        name: trimmedName,
        description: trimmedDescription,
        isSystem: false,
        defaultTransport: trip?.transportModes ? [...trip.transportModes] : undefined,
        defaultActivities: trip?.activities ? [...trip.activities] : undefined,
        defaultClimate: trip?.climate,
        defaultAccommodation: trip?.accommodationType,
        items: templateItems,
        createdAt: now,
        updatedAt: now,
      }

      await storage.templates.saveTemplate(newTemplate)

      set((state) => ({
        templates: [newTemplate, ...state.templates],
        isLoading: false,
        error: null,
      }))

      return newTemplate
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create template from trip'
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  updateTemplate: async (id: string, updates: Partial<PackingTemplate>) => {
    if (!id || !id.trim()) {
      throw new Error('Template ID is required')
    }

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim()
      if (!trimmed) {
        throw new Error('Template name cannot be empty')
      }
      if (trimmed.length > 60) {
        throw new Error('Template name cannot exceed 60 characters')
      }
    }

    if (updates.description !== undefined) {
      if (updates.description.trim().length > 200) {
        throw new Error('Template description cannot exceed 200 characters')
      }
    }

    let validatedItems: TemplateItemConfig[] | undefined
    if (updates.items !== undefined) {
      if (!Array.isArray(updates.items) || updates.items.length === 0) {
        throw new Error('Template must contain at least one item')
      }
      validatedItems = updates.items.map((item, idx) => validateTemplateItem(item, idx))
    }

    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      const existing = await storage.templates.getTemplateById(id)
      if (!existing) {
        throw new Error(`Template not found: ${id}`)
      }

      if (existing.isSystem) {
        throw new Error('Predefined system templates cannot be modified')
      }

      const finalName = updates.name !== undefined ? updates.name.trim() : existing.name
      if (!finalName) {
        throw new Error('Template name cannot be empty')
      }
      if (finalName.length > 60) {
        throw new Error('Template name cannot exceed 60 characters')
      }

      const finalDescription = updates.description !== undefined ? updates.description.trim() : existing.description
      if (finalDescription.length > 200) {
        throw new Error('Template description cannot exceed 200 characters')
      }

      const finalItems = validatedItems !== undefined ? validatedItems : existing.items

      const updatedTemplate: PackingTemplate = {
        ...existing,
        ...updates,
        name: finalName,
        description: finalDescription,
        items: finalItems,
        isSystem: false, // Custom template invariant: cannot be set to system template
        updatedAt: new Date().toISOString(),
      }

      await storage.templates.saveTemplate(updatedTemplate)

      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? updatedTemplate : t)),
        isLoading: false,
        error: null,
      }))

      return updatedTemplate
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update template'
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  deleteTemplate: async (id: string) => {
    if (!id || !id.trim()) {
      throw new Error('Template ID is required')
    }

    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      const existing = await storage.templates.getTemplateById(id)

      if (existing?.isSystem) {
        throw new Error('Predefined system templates cannot be deleted')
      }

      await storage.templates.deleteTemplate(id)

      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
        isLoading: false,
        error: null,
      }))
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete template'
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  getTemplateById: (id: string) => {
    return get().templates.find((t) => t.id === id)
  },

  clearError: () => {
    set({ error: null })
  },
}))
