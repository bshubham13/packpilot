/**
 * PackPilot — Restore Backup UI Component
 * Milestone 8B-3: Safe file selection, schema validation, preview inspection,
 * merge/replace modes, and coordinated lifecycle restoration.
 * Visual Identity: Travel Scrapbook + Adventure Editorial.
 */

import React, { useState, useRef, useCallback } from 'react'
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCw,
  Luggage,
  CheckSquare,
  Bookmark,
  Calendar,
  Layers,
  FileText,
  X,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import {
  readAndValidateBackupFile,
  executeRestoreWorkflow,
} from './restoreWorkflow'
import type { StorageContext } from '../../db/interfaces'
import type {
  PackPilotBackupPayload,
  RestoreResult,
  RestoreMode,
} from '../../types/backup'

export type RestoreCardStatus =
  | { type: 'idle' }
  | { type: 'restoring' }
  | { type: 'success'; result: RestoreResult }
  | { type: 'error'; result?: RestoreResult; message?: string }

export interface RestoreBackupCardProps {
  /**
   * Optional storage context override (for testing or custom storage contexts).
   */
  storage?: StorageContext
  /**
   * Optional initial payload to display in preview (useful for testing or preloaded previews).
   */
  initialPayload?: PackPilotBackupPayload
  /**
   * Optional initial restore mode ('merge' | 'replace'). Defaults to 'merge'.
   */
  initialMode?: RestoreMode
  /**
   * Optional status override for testing or controlled preview of UI states.
   */
  statusOverride?: RestoreCardStatus
  /**
   * Optional callback when restore and synchronization complete successfully.
   */
  onRestoreSuccess?: (result: RestoreResult) => void
  /**
   * Optional callback when restore fails (storage failure or post-restore sync failure).
   */
  onRestoreError?: (result: RestoreResult | Error) => void
  /**
   * Optional callback when restore execution starts or stops.
   */
  onRestoringChange?: (isRestoring: boolean) => void
  /**
   * Additional container CSS classes.
   */
  className?: string
}

function formatExportDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return isoString
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
  } catch {
    return isoString
  }
}

export const RestoreBackupCard: React.FC<RestoreBackupCardProps> = ({
  storage,
  initialPayload,
  initialMode = 'merge',
  statusOverride,
  onRestoreSuccess,
  onRestoreError,
  onRestoringChange,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [selectedFileName, setSelectedFileName] = useState<string | null>(
    initialPayload ? 'preloaded-backup.json' : null
  )
  const [previewData, setPreviewData] = useState<PackPilotBackupPayload | null>(
    initialPayload ?? null
  )
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [mode, setMode] = useState<RestoreMode>(initialMode)
  const [isConfirmedReplace, setIsConfirmedReplace] = useState<boolean>(false)

  const [internalStatus, setInternalStatus] = useState<RestoreCardStatus>({ type: 'idle' })
  const status = statusOverride ?? internalStatus
  const isRestoring = status.type === 'restoring'

  // Handle file selection from input
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      const file = files[0]
      setSelectedFileName(file.name)
      setValidationErrors([])
      setInternalStatus({ type: 'idle' })
      setIsConfirmedReplace(false)

      try {
        const validation = await readAndValidateBackupFile(file)
        if (validation.valid && validation.data) {
          setPreviewData(validation.data)
          setValidationErrors([])
        } else {
          setPreviewData(null)
          setValidationErrors(validation.errors)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setPreviewData(null)
        setValidationErrors([`File read error: ${msg}`])
      }
    },
    []
  )

  // Clear selected file and reset preview
  const handleClearFile = useCallback(() => {
    setSelectedFileName(null)
    setPreviewData(null)
    setValidationErrors([])
    setIsConfirmedReplace(false)
    setInternalStatus({ type: 'idle' })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Execute restore behind confirmation
  const handleRestore = useCallback(async () => {
    if (!previewData || isRestoring) return

    // Require explicit confirmation for replace mode
    if (mode === 'replace' && !isConfirmedReplace) return

    setInternalStatus({ type: 'restoring' })
    onRestoringChange?.(true)

    try {
      const result = await executeRestoreWorkflow(previewData, mode, storage)

      if (result.success) {
        setInternalStatus({ type: 'success', result })
        onRestoreSuccess?.(result)
      } else {
        setInternalStatus({ type: 'error', result })
        onRestoreError?.(result)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setInternalStatus({
        type: 'error',
        message: error.message,
      })
      onRestoreError?.(error)
    } finally {
      onRestoringChange?.(false)
    }
  }, [previewData, isRestoring, mode, isConfirmedReplace, storage, onRestoreSuccess, onRestoreError, onRestoringChange])

  return (
    <Card
      variant="scrapbook"
      padding="md"
      className={`border border-sand/40 bg-warm-white shadow-card ${className}`.trim()}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2.5 rounded-card bg-terracotta/10 text-terracotta shrink-0 mt-0.5">
          <Layers className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-serif font-bold text-lg text-ink-black tracking-tight">
            Restore From Backup
          </h3>
          <p className="text-sm text-sand-dark leading-relaxed">
            Import trips and checklists from a previously exported PackPilot JSON backup.
          </p>
        </div>
      </div>

      {/* File Selector */}
      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          disabled={isRestoring}
          className="sr-only"
          id="restore-file-input"
          data-testid="restore-file-input"
          aria-label="Choose a PackPilot JSON backup file"
        />

        {!selectedFileName ? (
          <label
            htmlFor="restore-file-input"
            className="flex flex-col items-center justify-center p-5 sm:p-6 border-2 border-dashed border-sand/60 hover:border-sand-dark/80 rounded-card bg-sand/10 hover:bg-sand/20 cursor-pointer transition-colors text-center"
            data-testid="restore-file-dropzone"
          >
            <UploadCloud className="w-7 h-7 text-sand-dark mb-2 opacity-80" aria-hidden="true" />
            <span className="text-sm font-semibold text-ink-black">Choose a backup file (.json)</span>
            <span className="text-xs text-sand-dark mt-1">
              Supports standard PackPilot JSON backups up to 15 MB
            </span>
          </label>
        ) : (
          <div
            className="flex items-center justify-between p-3 rounded-card bg-sand/15 border border-sand/30"
            data-testid="selected-file-chip"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <FileText className="w-4 h-4 text-forest-green shrink-0" aria-hidden="true" />
              <span className="text-xs font-mono font-medium text-ink-black truncate">
                {selectedFileName}
              </span>
            </div>
            {!isRestoring && (
              <button
                type="button"
                onClick={handleClearFile}
                className="text-xs text-sand-dark hover:text-terracotta transition-colors flex items-center gap-1 font-medium ml-2 shrink-0 cursor-pointer"
                aria-label="Choose a different backup file"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Change</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Validation Errors Notice */}
      {validationErrors.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="validation-error-banner"
          className="p-3 mb-4 rounded-card bg-terracotta/10 border border-terracotta/30 text-xs text-terracotta"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold uppercase tracking-wider">Invalid Backup File</p>
              <ul className="list-disc list-inside space-y-0.5 leading-relaxed">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Backup Preview (Shown ONLY after validation succeeds) */}
      {previewData && (
        <div
          className="mb-5 p-3.5 rounded-card bg-warm-white border border-sand/50 shadow-xs"
          data-testid="backup-preview-section"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-3 border-b border-sand/20">
            <div className="flex items-center gap-1.5 text-xs text-sand-dark">
              <Calendar className="w-3.5 h-3.5 text-sand-dark" aria-hidden="true" />
              <span>Exported:</span>
              <span className="font-mono font-medium text-ink-black">
                {formatExportDate(previewData.exportedAt)}
              </span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-forest-green/10 text-forest-green font-medium border border-forest-green/20">
              {`Schema v${previewData.version} (Compatible)`}
            </span>
          </div>

          {/* Preview Record Counts */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-card bg-sand/15 border border-sand/25">
              <Luggage className="w-4 h-4 text-forest-green mx-auto mb-1 opacity-80" aria-hidden="true" />
              <span
                className="text-lg font-bold font-mono text-ink-black block leading-none"
                data-testid="preview-trips-count"
              >
                {previewData.trips.length}
              </span>
              <span className="text-[11px] text-sand-dark font-medium">Trips</span>
            </div>

            <div className="p-2.5 rounded-card bg-sand/15 border border-sand/25">
              <CheckSquare className="w-4 h-4 text-terracotta mx-auto mb-1 opacity-80" aria-hidden="true" />
              <span
                className="text-lg font-bold font-mono text-ink-black block leading-none"
                data-testid="preview-items-count"
              >
                {previewData.items.length}
              </span>
              <span className="text-[11px] text-sand-dark font-medium">Items</span>
            </div>

            <div className="p-2.5 rounded-card bg-sand/15 border border-sand/25">
              <Bookmark className="w-4 h-4 text-sunshine-yellow mx-auto mb-1 opacity-80" aria-hidden="true" />
              <span
                className="text-lg font-bold font-mono text-ink-black block leading-none"
                data-testid="preview-templates-count"
              >
                {previewData.templates.length}
              </span>
              <span className="text-[11px] text-sand-dark font-medium">Templates</span>
            </div>
          </div>
        </div>
      )}

      {/* Restore Mode Selection (Visible only when preview is valid) */}
      {previewData && (
        <div className="mb-5 space-y-3" data-testid="restore-mode-options">
          <p className="text-xs font-semibold uppercase tracking-wider text-sand-dark">
            Restore Strategy
          </p>

          <div className="space-y-2">
            {/* Merge Option (Default) */}
            <label
              className={`flex items-start gap-3 p-3 rounded-card border cursor-pointer transition-colors ${
                mode === 'merge'
                  ? 'bg-sand/15 border-forest-green/50 shadow-xs'
                  : 'bg-warm-white border-sand/30 hover:bg-sand/10'
              }`}
            >
              <input
                type="radio"
                name="restore-mode"
                value="merge"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
                disabled={isRestoring}
                className="mt-1 text-forest-green focus:ring-forest-green"
                data-testid="mode-merge-radio"
              />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold text-ink-black block text-sm">
                  Merge into existing data (Default)
                </span>
                <span className="text-sand-dark mt-0.5 block">
                  Imports new trips and templates. Existing trips with matching IDs are preserved
                  as-is, and duplicate checklist items are safely skipped without overwriting.
                </span>
              </div>
            </label>

            {/* Replace Option */}
            <label
              className={`flex items-start gap-3 p-3 rounded-card border cursor-pointer transition-colors ${
                mode === 'replace'
                  ? 'bg-sand/15 border-terracotta/50 shadow-xs'
                  : 'bg-warm-white border-sand/30 hover:bg-sand/10'
              }`}
            >
              <input
                type="radio"
                name="restore-mode"
                value="replace"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                disabled={isRestoring}
                className="mt-1 text-terracotta focus:ring-terracotta"
                data-testid="mode-replace-radio"
              />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold text-ink-black block text-sm">
                  Replace all data
                </span>
                <span className="text-sand-dark mt-0.5 block">
                  Completely replaces all current trips, checklist items, and templates stored in
                  this browser with the contents of this backup file.
                </span>
              </div>
            </label>
          </div>

          {/* Explicit Replace Confirmation Requirement */}
          {mode === 'replace' && (
            <div
              className="p-3 rounded-card bg-terracotta/10 border border-terracotta/30 space-y-2.5"
              data-testid="replace-confirmation-box"
            >
              <div className="flex items-start gap-2 text-xs text-terracotta font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Permanent action: All current local trips and items will be erased. Un-exported
                  changes cannot be recovered.
                </span>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-terracotta/20 text-xs font-semibold text-ink-black select-none">
                <input
                  type="checkbox"
                  checked={isConfirmedReplace}
                  onChange={(e) => setIsConfirmedReplace(e.target.checked)}
                  disabled={isRestoring}
                  className="mt-0.5 rounded border-sand text-terracotta focus:ring-terracotta"
                  data-testid="replace-confirm-checkbox"
                />
                <span>I understand and confirm that all existing local data will be replaced.</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Success Notification */}
      {status.type === 'success' && (
        <div
          role="status"
          aria-live="polite"
          data-testid="restore-success-banner"
          className="p-3 mb-4 rounded-card bg-forest-green/10 border border-forest-green/30 text-sm text-forest-green flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-snug">
            <p className="font-semibold text-forest-green">Restore completed successfully!</p>
            <p className="text-xs text-forest-green/80 mt-1 font-mono">
              {`Imported: ${status.result.imported.trips} trips, ${status.result.imported.items} items, ${status.result.imported.templates} templates (${status.result.mode} mode).`}
            </p>
            {status.result.skipped.trips > 0 || status.result.skipped.items > 0 ? (
              <p className="text-xs text-forest-green/80 mt-0.5 font-mono">
                {`Skipped: ${status.result.skipped.trips} existing trips, ${status.result.skipped.items} items preserved.`}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Failure Notification: Case 1 — Storage Committed but Store Sync Failed */}
      {status.type === 'error' && status.result?.storageCommitted && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="restore-sync-error-banner"
          className="p-3.5 mb-4 rounded-card bg-sunshine-yellow/20 border border-sunshine-yellow/60 text-sm text-ink-black flex flex-col gap-2"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-ink-black shrink-0 mt-0.5" aria-hidden="true" />
            <div className="leading-snug">
              <p className="font-semibold text-ink-black">
                Data restored to storage, but view could not refresh
              </p>
              <p className="text-xs text-sand-dark mt-1">
                Your backup was successfully committed to browser storage, but the active screen view
                could not refresh automatically.
              </p>
              <p className="text-xs font-medium text-ink-black mt-1.5">
                Do NOT import this backup file again. Simply reload the page to refresh your view.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-sand/30 flex justify-end">
            <Button
              variant="forest"
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload()
              }}
              leftIcon={<RotateCw className="w-3.5 h-3.5" aria-hidden="true" />}
              data-testid="reload-page-btn"
            >
              Reload Page
            </Button>
          </div>
        </div>
      )}

      {/* Failure Notification: Case 2 — Storage Restoration Failed (Rolled Back) */}
      {status.type === 'error' && !status.result?.storageCommitted && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="restore-storage-error-banner"
          className="p-3 mb-4 rounded-card bg-terracotta/10 border border-terracotta/30 text-sm text-terracotta flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-snug">
            <p className="font-semibold text-terracotta">Storage restore failed</p>
            <p className="text-xs text-terracotta/90 mt-0.5 leading-relaxed">
              {status.message ||
                status.result?.errors.join('; ') ||
                'An unexpected error occurred while restoring data into browser storage.'}
            </p>
            <p className="text-[11px] text-terracotta/80 mt-1 font-medium">
              Storage transaction was rolled back. Existing database records were preserved without changes.
            </p>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-sand/30">
        <div className="text-xs text-sand-dark">
          {!previewData ? (
            <span>Select a valid backup file to preview and restore.</span>
          ) : mode === 'replace' ? (
            <span>Ready to completely replace existing data.</span>
          ) : (
            <span>Ready to merge new records into local storage.</span>
          )}
        </div>

        <Button
          variant={mode === 'replace' ? 'terracottaDark' : 'forest'}
          size="md"
          onClick={handleRestore}
          disabled={
            !previewData ||
            isRestoring ||
            (mode === 'replace' && !isConfirmedReplace)
          }
          isLoading={isRestoring}
          className="w-full sm:w-auto font-medium"
          aria-label={
            mode === 'replace' ? 'Replace and Restore All Data' : 'Merge Backup Data'
          }
          data-testid="restore-action-btn"
        >
          {isRestoring
            ? 'Restoring Backup...'
            : mode === 'replace'
            ? 'Replace and Restore All Data'
            : 'Merge Backup Data'}
        </Button>
      </div>
    </Card>
  )
}
