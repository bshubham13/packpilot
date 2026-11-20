import React, { useState, useEffect } from 'react'
import { BookmarkPlus, Check, AlertCircle } from 'lucide-react'
import { Modal, Button } from '../ui'
import { useTemplateStore } from '../../stores/templateStore'
import type { PackingItem, PackingTemplate } from '../../types'

export interface SaveTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: string
  items: PackingItem[]
  onSuccess?: (template: PackingTemplate) => void
}

export function SaveTemplateModal({
  isOpen,
  onClose,
  tripId,
  items,
  onSuccess,
}: SaveTemplateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { createTemplateFromTrip } = useTemplateStore()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setDescription('')
      setError(null)
      setSuccessMessage(null)
      setIsSubmitting(false)
    }
  }, [isOpen])

  const activeItemsCount = items.filter(
    (item) => (item.effectiveQuantity ?? item.generatedQuantity) > 0
  ).length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Please provide a name for your template.')
      return
    }

    if (trimmedName.length > 60) {
      setError('Template name cannot exceed 60 characters.')
      return
    }

    if (description.length > 200) {
      setError('Description cannot exceed 200 characters.')
      return
    }

    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const created = await createTemplateFromTrip({
        tripId,
        name: trimmedName,
        description: description.trim(),
        items,
      })

      setSuccessMessage(`Template "${created.name}" saved successfully!`)
      if (onSuccess) {
        onSuccess(created)
      }

      // Close modal smoothly after brief feedback
      setTimeout(() => {
        onClose()
      }, 750)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save template. Please try again.')
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
      title="Save Checklist as Template"
      description="Create a reusable packing template snapshot from this journey's checklist."
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="save-template-form">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-card bg-red-50 border border-terracotta/40 text-xs text-red-900 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="p-3 rounded-card bg-forest-green/10 border border-forest-green/30 text-xs text-forest-green flex items-start gap-2"
          >
            <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Template Overview Pill */}
        <div className="p-3 rounded-card bg-sand/15 border border-sand/30 flex items-center justify-between text-xs text-ink-black/75">
          <span className="font-medium">Items included in template:</span>
          <span className="font-bold text-ink-black px-2 py-0.5 bg-sand/25 rounded-full">
            {`${activeItemsCount} items`}
          </span>
        </div>

        {/* Template Name */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="template-name-input"
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
            id="template-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Summer Weekend Roadtrip"
            disabled={isSubmitting || Boolean(successMessage)}
            className="w-full px-3 py-2 text-sm bg-warm-white border border-sand/60 rounded-card focus:outline-none focus:ring-1 focus:ring-terracotta focus:border-terracotta transition-colors disabled:opacity-50"
            autoFocus
          />
        </div>

        {/* Template Description */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="template-description-input"
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
            id="template-description-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            placeholder="Brief notes about which journeys this template suits best..."
            disabled={isSubmitting || Boolean(successMessage)}
            className="w-full px-3 py-2 text-sm bg-warm-white border border-sand/60 rounded-card focus:outline-none focus:ring-1 focus:ring-terracotta focus:border-terracotta transition-colors resize-none disabled:opacity-50"
          />
        </div>

        {/* Form Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-sand/40">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGuardedClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            leftIcon={<BookmarkPlus className="w-3.5 h-3.5" />}
            isLoading={isSubmitting}
            disabled={!name.trim() || name.length > 60 || description.length > 200 || isSubmitting || Boolean(successMessage)}
          >
            {isSubmitting ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
