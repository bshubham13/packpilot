import {
  FileText,
  Shirt,
  Sparkles,
  Smartphone,
  Backpack,
  HeartPulse,
  Package,
  type LucideIcon,
} from 'lucide-react'
import type { PackingCategory } from '../../types'

export interface CategoryInfo {
  label: string
  icon: LucideIcon
}

export const CATEGORY_INFO_MAP: Record<PackingCategory, CategoryInfo> = {
  documents: {
    label: 'Documents & IDs',
    icon: FileText,
  },
  clothing: {
    label: 'Clothing & Apparel',
    icon: Shirt,
  },
  toiletries: {
    label: 'Toiletries & Care',
    icon: Sparkles,
  },
  electronics: {
    label: 'Electronics & Tech',
    icon: Smartphone,
  },
  gear: {
    label: 'Gear & Equipment',
    icon: Backpack,
  },
  health: {
    label: 'Health & Safety',
    icon: HeartPulse,
  },
  miscellaneous: {
    label: 'Miscellaneous',
    icon: Package,
  },
}

export const PACKING_CATEGORIES: { key: PackingCategory; label: string }[] = [
  { key: 'documents', label: 'Documents & IDs' },
  { key: 'clothing', label: 'Clothing & Apparel' },
  { key: 'toiletries', label: 'Toiletries & Care' },
  { key: 'electronics', label: 'Electronics & Tech' },
  { key: 'gear', label: 'Gear & Equipment' },
  { key: 'health', label: 'Health & Safety' },
  { key: 'miscellaneous', label: 'Miscellaneous' },
]

export function formatWeight(weightGrams?: number): string | null {
  if (weightGrams === undefined || weightGrams === null || !Number.isFinite(weightGrams) || weightGrams <= 0) {
    return null
  }
  if (weightGrams >= 1000) {
    const kg = weightGrams / 1000
    return `${kg.toFixed(kg % 1 === 0 ? 0 : 1)} kg`
  }
  return `${Math.round(weightGrams)} g`
}
