import { useState, useEffect, type FormEvent } from 'react'
import {
  Edit3,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Info,
  Lock,
} from 'lucide-react'
import { Modal, Button, Badge } from '../ui'
import { useTemplateStore } from '../../stores/templateStore'
import { generateUUID } from '../../utils/uuid'
import type {
  PackingTemplate,
  TemplateItemConfig,
  PackingCategory,
  ItemPriority,
} from '../../types'
import { PACKING_CATEGORIES, CATEGORY_INFO_MAP } from './categoryHelpers'

export interface EditTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  template: PackingTemplate | null
  onSuccess?: (updatedTemplate: PackingTemplate) => void
}

export function EditTemplateModal({
  isOpen,
  onClose,
  template,
  onSuccess,
}: EditTemplateModalProps) {
  const [name, setName] = useState(() => template?.name || '')
  const [description, setDescription] = useState(() => template?.description || '')
  const [items, setItems] = useState<TemplateItemConfig[]>(() =>
    template?.items ? template.items.map((i) => ({ ...i })) : []
  )

  // New item draft inputs
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState<PackingCategory>('miscellaneous')
  const [newItemQty, setNewItemQty] = useState(1)
  const [newItemPriority, setNewItemPriority] = useState<ItemPriority>('recommended')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { updateTemplate } = useTemplateStore()

  // Reset form when modal opens or template changes
  useEffect(() => {
    if (isOpen && template) {
      setName(template.name)
      setDescription(template.description || '')
      setItems(template.items ? template.items.map((i) => ({ ...i })) : [])
      setNewItemName('')
      setNewItemCategory('miscellaneous')
      setNewItemQty(1)
      setNewItemPriority('recommended')
      setError(null)
      setSuccessMessage(null)
      setIsSubmitting(false)
    }
  }, [isOpen, template])

  if (!isOpen || !template) return null

  const handleItemNameChange = (index: number, val: string) => {
    setItems((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], name: val }
      return copy
    })
  }

  const handleItemQtyChange = (index: number, val: number) => {
    const safeQty = Math.max(1, Math.min(99, Math.floor(val) || 1))
    setItems((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], defaultQuantity: safeQty }
      return copy
    })
  }

  const handleItemPriorityChange = (index: number, val: ItemPriority) => {
    setItems((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], priority: val }
      return copy
    })
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddNewItem = () => {
    const trimmed = newItemName.trim()
    if (!trimmed) {
      setError('Please enter a name for the new item.')
      return
    }

    // Follow custom-item slug generation convention
    const newSlug = `custom-${generateUUID().slice(0, 8)}`
    const newItem: TemplateItemConfig = {
      name: trimmed,
      itemSlug: newSlug,
      category: newItemCategory,
      quantityStrategy: 'user_defined',
      defaultQuantity: Math.max(1, Math.min(99, Math.floor(newItemQty) || 1)),
      priority: newItemPriority,
      isShared: false,
      reasons: ['Added during template edit'],
    }

    setItems((prev) => [...prev, newItem])
    setNewItemName('')
    setNewItemQty(1)
    setNewItemPriority('recommended')
    setError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // 1. Predefined system template guard
    if (template.isSystem) {
      setError('Predefined system templates cannot be modified.')
      return
    }

    // 2. Name validation
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Template name is required.')
      return
    }
    if (trimmedName.length > 60) {
      setError('Template name cannot exceed 60 characters.')
      return
    }

    // 3. Description validation
    const trimmedDesc = description.trim()
    if (trimmedDesc.length > 200) {
      setError('Template description cannot exceed 200 characters.')
      return
    }

    // 4. Items array validation
    if (items.length === 0) {
      setError('Template must contain at least one item.')
      return
    }

    // 5. Individual items validation
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.name || !item.name.trim()) {
        setError(`Item #${i + 1} must have a valid name.`)
        return
      }
      if (
        typeof item.defaultQuantity !== 'number' ||
        !Number.isInteger(item.defaultQuantity) ||
        item.defaultQuantity < 1 ||
        item.defaultQuantity > 99
      ) {
        setError(`Item "${item.name}" must have a quantity between 1 and 99.`)
        return
      }
    }

    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const sanitizedItems: TemplateItemConfig[] = items.map((i) => ({
        ...i,
        name: i.name.trim(),
        defaultQuantity: Math.round(i.defaultQuantity),
      }))

      const updated = await updateTemplate(template.id, {
        name: trimmedName,
        description: trimmedDesc,
        items: sanitizedItems,
      })

      setSuccessMessage(`Template "${updated.name}" updated successfully!`)
      if (onSuccess) {
        onSuccess(updated)
      }

      setTimeout(() => {
        onClose()
      }, 600)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update template.')
      setIsSubmitting(false)
    }
  }

  const handleGuardedClose = () => {
    if (isSubmitting) return
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleGuardedClose}
      title="Edit Template"
      description="Update template metadata and manage saved checklist items."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="edit-template-form">
        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-3 rounded-card bg-red-50 border border-terracotta/40 text-xs text-red-900 flex items-start gap-2"
            data-testid="edit-template-error"
          >
            <AlertCircle className="w-4 h-4 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div
            role="status"
            className="p-3 rounded-card bg-forest-green/10 border border-forest-green/30 text-xs text-forest-green flex items-start gap-2"
            data-testid="edit-template-success"
          >
            <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* System Template Read-Only Lockout */}
        {template.isSystem ? (
          <div
            className="p-3 rounded-card bg-sand/30 border border-sand/50 text-xs text-ink-black flex items-start gap-2.5"
            data-testid="edit-template-system-locked"
          >
            <Lock className="w-4 h-4 text-ink-black/70 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <span className="font-semibold text-ink-black">Immutable Predefined Template</span>
              <p className="text-ink-black/70">
                Predefined templates are built-in and cannot be edited. You can create a customized copy by applying it to a trip checklist and saving it as a new custom template.
              </p>
            </div>
          </div>
        ) : (
          /* Trip Checklist Independence Disclaimer */
          <div className="p-2.5 rounded-card bg-sand/15 border border-sand/30 flex items-start gap-2 text-xs text-ink-black/70">
            <Info className="w-3.5 h-3.5 text-sand-dark shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Updating this template modifies the saved template only. It will not alter any existing trip checklists.
            </span>
          </div>
        )}

        {/* Template Name & Description */}
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="edit-template-name-input"
                className="block text-xs font-semibold text-ink-black"
              >
                Template Name <span className="text-terracotta">*</span>
              </label>
              <span
                className={`text-[10px] ${
                  name.length > 60 ? 'text-red-600 font-bold' : 'text-ink-black/50'
                }`}
              >
                {`${name.length}/60`}
              </span>
            </div>
            <input
              id="edit-template-name-input"
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting || template.isSystem}
              placeholder="e.g. My Beach Vacation Master Kit"
              className="w-full px-3 py-2 bg-warm-white border border-sand/60 rounded-card text-sm text-ink-black focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent disabled:opacity-50"
              data-testid="edit-template-name"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="edit-template-desc-input"
                className="block text-xs font-semibold text-ink-black"
              >
                Description <span className="text-ink-black/50 font-normal">(Optional)</span>
              </label>
              <span
                className={`text-[10px] ${
                  description.length > 200 ? 'text-red-600 font-bold' : 'text-ink-black/50'
                }`}
              >
                {`${description.length}/200`}
              </span>
            </div>
            <textarea
              id="edit-template-desc-input"
              rows={2}
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting || template.isSystem}
              placeholder="Add brief notes on when or how to use this template..."
              className="w-full px-3 py-2 bg-warm-white border border-sand/60 rounded-card text-xs text-ink-black focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent resize-none disabled:opacity-50"
              data-testid="edit-template-description"
            />
          </div>
        </div>

        {/* Template Items Header & Add Item Row */}
        {!template.isSystem && (
          <div className="space-y-3 pt-2 border-t border-sand/30">
            <div className="flex items-center justify-between">
              <span className="font-serif font-bold text-sm text-ink-black">
                {`Template Items (${items.length})`}
              </span>
              <span className="text-[11px] text-ink-black/50">
                Minimum 1 item required
              </span>
            </div>

            {/* Add Custom Item Sub-form */}
            <div className="p-3 rounded-card bg-sand/15 border border-sand/40 space-y-2">
              <span className="text-[11px] font-semibold text-ink-black/80 block uppercase tracking-wide">
                Add New Item to Template
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-5 space-y-0.5">
                  <label htmlFor="new-item-name" className="text-[10px] font-semibold text-ink-black/70 block">
                    Item Name
                  </label>
                  <input
                    id="new-item-name"
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g. Scuba Mask"
                    disabled={isSubmitting}
                    className="w-full px-2.5 py-1.5 bg-warm-white border border-sand/60 rounded-card text-xs text-ink-black focus:outline-none focus:ring-2 focus:ring-terracotta"
                    data-testid="new-item-name-input"
                  />
                </div>

                <div className="sm:col-span-3 space-y-0.5">
                  <label htmlFor="new-item-category" className="text-[10px] font-semibold text-ink-black/70 block">
                    Category
                  </label>
                  <select
                    id="new-item-category"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as PackingCategory)}
                    disabled={isSubmitting}
                    className="w-full px-2 py-1.5 bg-warm-white border border-sand/60 rounded-card text-xs text-ink-black focus:outline-none focus:ring-2 focus:ring-terracotta"
                    data-testid="new-item-category-select"
                  >
                    {PACKING_CATEGORIES.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-0.5">
                  <label htmlFor="new-item-qty" className="text-[10px] font-semibold text-ink-black/70 block">
                    Qty (1–99)
                  </label>
                  <input
                    id="new-item-qty"
                    type="number"
                    min={1}
                    max={99}
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(Number.parseInt(e.target.value, 10) || 1)}
                    disabled={isSubmitting}
                    className="w-full px-2 py-1.5 bg-warm-white border border-sand/60 rounded-card text-xs text-ink-black focus:outline-none focus:ring-2 focus:ring-terracotta"
                    data-testid="new-item-qty-input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    fullWidth
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={handleAddNewItem}
                    disabled={isSubmitting || !newItemName.trim()}
                    data-testid="add-new-item-btn"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Existing Items Editable List */}
            <div
              className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1"
              data-testid="edit-template-items-list"
            >
              {items.length === 0 ? (
                <div className="p-4 rounded-card border border-dashed border-red-300 bg-red-50 text-center text-xs text-red-800">
                  No items remaining. Please add at least one item before saving.
                </div>
              ) : (
                items.map((item, idx) => {
                  const catInfo = CATEGORY_INFO_MAP[item.category]
                  return (
                    <div
                      key={item.itemSlug || idx}
                      className="p-2 rounded-card border border-sand/40 bg-warm-white flex items-center justify-between gap-2 text-xs"
                      data-testid={`editable-item-${item.itemSlug}`}
                    >
                      {/* Name input */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => handleItemNameChange(idx, e.target.value)}
                          disabled={isSubmitting}
                          className="w-full px-2 py-1 bg-transparent border-b border-transparent hover:border-sand/60 focus:border-terracotta focus:outline-none font-medium text-ink-black text-xs"
                          data-testid={`item-name-input-${idx}`}
                        />
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-ink-black/50">
                          <Badge variant="outline" size="sm" className="text-[9px] py-0 px-1 border-sand/40">
                            {catInfo?.label || item.category}
                          </Badge>
                          {item.weightGrams ? <span>{item.weightGrams}g</span> : null}
                          {item.isShared ? <span>• Shared</span> : null}
                        </div>
                      </div>

                      {/* Quantity input */}
                      <div className="w-16 shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={item.defaultQuantity}
                          onChange={(e) => handleItemQtyChange(idx, Number.parseInt(e.target.value, 10))}
                          disabled={isSubmitting}
                          className="w-full px-1.5 py-1 bg-sand/15 border border-sand/40 rounded-card text-center font-bold text-xs text-ink-black focus:outline-none focus:ring-1 focus:ring-terracotta"
                          data-testid={`item-qty-input-${idx}`}
                        />
                      </div>

                      {/* Priority select */}
                      <div className="w-28 shrink-0">
                        <select
                          value={item.priority}
                          onChange={(e) => handleItemPriorityChange(idx, e.target.value as ItemPriority)}
                          disabled={isSubmitting}
                          className="w-full px-1.5 py-1 bg-sand/15 border border-sand/40 rounded-card text-[11px] text-ink-black focus:outline-none focus:ring-1 focus:ring-terracotta capitalize"
                          data-testid={`item-priority-select-${idx}`}
                        >
                          <option value="critical">Critical</option>
                          <option value="recommended">Recommended</option>
                          <option value="optional">Optional</option>
                        </select>
                      </div>

                      {/* Remove item button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={isSubmitting}
                        aria-label={`Remove ${item.name}`}
                        className="p-1.5 text-ink-black/40 hover:text-red-600 hover:bg-red-50 rounded-card transition-colors cursor-pointer shrink-0"
                        data-testid={`remove-item-btn-${idx}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-3 flex items-center justify-end gap-2 border-t border-sand/30">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGuardedClose}
            disabled={isSubmitting}
            data-testid="cancel-edit-template-btn"
          >
            Cancel
          </Button>
          {!template.isSystem && (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              isLoading={isSubmitting}
              disabled={isSubmitting || items.length === 0 || !name.trim()}
              data-testid="save-edit-template-btn"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
