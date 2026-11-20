import { useState } from 'react'
import { RotateCcw, AlertTriangle, AlertCircle } from 'lucide-react'
import { Modal, Button } from '../ui'
import { useChecklistStore } from '../../stores/checklistStore'
import type { Trip } from '../../types'

export interface RegenerateChecklistModalProps {
  isOpen: boolean
  onClose: () => void
  trip: Trip
  onSuccess?: () => void
}

export function RegenerateChecklistModal({
  isOpen,
  onClose,
  trip,
  onSuccess,
}: RegenerateChecklistModalProps) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { regenerateChecklist } = useChecklistStore()

  const handleConfirm = async () => {
    if (isRegenerating) return

    setIsRegenerating(true)
    setError(null)

    try {
      await regenerateChecklist(trip)
      if (onSuccess) {
        onSuccess()
      }
      onClose()
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to regenerate checklist. Please try again.'
      )
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleGuardedClose = () => {
    if (isRegenerating) return
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleGuardedClose}
      title="Regenerate Packing Checklist"
      description="Recompute recommendation rules based on your journey's current parameters."
    >
      <div className="space-y-4 text-ink-black" data-testid="regenerate-checklist-modal">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-card bg-red-50 border border-terracotta/40 text-xs text-red-900 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Advisory Warning Banner */}
        <div
          role="alert"
          className="p-3.5 rounded-card bg-sand/20 border border-sand/60 space-y-2 text-xs font-sans text-ink-black"
        >
          <div className="flex items-center gap-2 font-bold text-terracotta text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Recommendation Recalculation Notice</span>
          </div>
          <p className="leading-relaxed text-ink-black/80">
            Regenerating recalculates your packing checklist using PackPilot's rule engine for your
            trip's duration, transport, accommodation, activities, and laundry access.
          </p>
          <div className="border-t border-sand/40 pt-2 space-y-1.5 text-xs text-ink-black/80">
            <div className="font-semibold text-ink-black">Important effects to keep in mind:</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong>Template Items:</strong> Items added from templates that are not part of your
                trip's selected activities or conditions may be flagged as orphaned for review.
              </li>
              <li>
                <strong>Template Quantities:</strong> Automatically calculated items boosted by templates
                may be recalculated back to rule-based baselines.
              </li>
              <li>
                <strong>Preserved Data:</strong> Custom items you created, manual quantity overrides,
                item notes, and your packed progress are strictly preserved.
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-sand/40">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGuardedClose}
            disabled={isRegenerating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            isLoading={isRegenerating}
            disabled={isRegenerating}
            onClick={handleConfirm}
            data-testid="confirm-regenerate-btn"
          >
            {isRegenerating ? 'Regenerating...' : 'Confirm & Regenerate'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
