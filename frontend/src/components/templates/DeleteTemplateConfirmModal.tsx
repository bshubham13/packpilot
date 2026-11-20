import { useState } from 'react'
import { Trash2, AlertTriangle, AlertCircle, Lock } from 'lucide-react'
import { Modal, Button } from '../ui'
import { useTemplateStore } from '../../stores/templateStore'
import type { PackingTemplate } from '../../types'

export interface DeleteTemplateConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  template: PackingTemplate | null
  onSuccess?: (deletedId: string) => void
}

export function DeleteTemplateConfirmModal({
  isOpen,
  onClose,
  template,
  onSuccess,
}: DeleteTemplateConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { deleteTemplate } = useTemplateStore()

  if (!isOpen || !template) return null

  const handleConfirmDelete = async () => {
    if (template.isSystem) {
      setError('Predefined system templates cannot be deleted.')
      return
    }

    if (isDeleting) return

    setIsDeleting(true)
    setError(null)

    try {
      await deleteTemplate(template.id)
      if (onSuccess) {
        onSuccess(template.id)
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete template.')
      setIsDeleting(false)
    }
  }

  const handleGuardedClose = () => {
    if (isDeleting) return
    setError(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleGuardedClose}
      title="Delete Packing Template"
      size="sm"
    >
      <div className="space-y-4" data-testid="delete-template-confirm-modal">
        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-3 rounded-card bg-red-50 border border-terracotta/40 text-xs text-red-900 flex items-start gap-2"
            data-testid="delete-template-error"
          >
            <AlertCircle className="w-4 h-4 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* System Template Lockout */}
        {template.isSystem ? (
          <div
            className="p-3 rounded-card bg-sand/30 border border-sand/50 text-xs text-ink-black flex items-start gap-2.5"
            data-testid="delete-template-system-locked"
          >
            <Lock className="w-4 h-4 text-ink-black/70 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <span className="font-semibold text-ink-black">Immutable Predefined Template</span>
              <p className="text-ink-black/70">
                Predefined templates are part of the core PackPilot engine and cannot be deleted.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Confirmation Prompt */}
            <div className="flex items-start gap-3 p-3 rounded-card bg-amber-50 border border-amber-200 text-amber-950">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-sm text-ink-black">
                  Are you sure you want to delete <span className="font-bold font-serif text-terracotta">"{template.name}"</span>?
                </p>
                <p className="text-ink-black/75 leading-relaxed">
                  This will remove the template from your saved templates library.
                </p>
              </div>
            </div>

            {/* Checklist Independence Guarantee */}
            <div className="p-2.5 rounded-card bg-sand/15 border border-sand/30 text-xs text-ink-black/70">
              <strong>Checklist Safety:</strong> Deleting this template will not affect any existing trip checklists or packed items. Any items previously added to your trips from this template will remain safely intact.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 flex items-center justify-end gap-2 border-t border-sand/30">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGuardedClose}
            disabled={isDeleting}
            data-testid="cancel-delete-template-btn"
          >
            Cancel
          </Button>

          {!template.isSystem && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              isLoading={isDeleting}
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              data-testid="confirm-delete-template-btn"
            >
              {isDeleting ? 'Deleting Template...' : 'Delete Template'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
