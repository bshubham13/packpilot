/**
 * PackPilot — Export Backup UI Component
 * Milestone 8B-2: Local data summary, JSON serialization, and safe download trigger.
 * Visual Identity: Travel Scrapbook + Adventure Editorial.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Download,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Luggage,
  CheckSquare,
  Bookmark,
  HardDriveDownload,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { executeExportBackup } from './exportWorkflow'
import { getStorageContext } from '../../db/factory'
import type { StorageContext } from '../../db/interfaces'
import type { PackPilotBackupPayload } from '../../types/backup'

export interface ExportBackupSummary {
  trips: number
  items: number
  templates: number
}

export type ExportStatus =
  | { type: 'idle' }
  | { type: 'exporting' }
  | {
      type: 'success'
      filename: string
      exportedAt: string
      counts: ExportBackupSummary
    }
  | { type: 'error'; error: string }

export interface ExportBackupCardProps {
  /**
   * Optional custom storage context override (defaults to getStorageContext()).
   */
  storage?: StorageContext
  /**
   * Optional initial summary counts. If provided, used immediately before background refresh.
   */
  initialSummary?: ExportBackupSummary
  /**
   * Optional status override for controlled preview or testing of UI states.
   */
  statusOverride?: ExportStatus
  /**
   * Optional callback when an export and download completes successfully.
   */
  onExportSuccess?: (payload: PackPilotBackupPayload, filename: string) => void
  /**
   * Optional callback when an export or download fails.
   */
  onExportError?: (error: Error) => void
  /**
   * Additional container CSS classes.
   */
  className?: string
}

export const ExportBackupCard: React.FC<ExportBackupCardProps> = ({
  storage,
  initialSummary,
  statusOverride,
  onExportSuccess,
  onExportError,
  className = '',
}) => {
  const [summary, setSummary] = useState<ExportBackupSummary>(
    initialSummary ?? { trips: 0, items: 0, templates: 0 }
  )
  const [internalStatus, setInternalStatus] = useState<ExportStatus>({ type: 'idle' })
  const status = statusOverride ?? internalStatus
  const isExporting = status.type === 'exporting'

  // Load summary counts from storage on mount
  useEffect(() => {
    let isMounted = true

    async function fetchCounts() {
      try {
        const store = storage || getStorageContext()
        const [trips, items, templates] = await Promise.all([
          store.trips.getAllTrips(),
          store.items.getAllItems(),
          store.templates.getAllTemplates(),
        ])

        if (isMounted) {
          setSummary({
            trips: trips.length,
            items: items.length,
            templates: templates.length,
          })
        }
      } catch {
        // Fall back gracefully if storage is uninitialized or empty
        if (isMounted && !initialSummary) {
          setSummary({ trips: 0, items: 0, templates: 0 })
        }
      }
    }

    void fetchCounts()

    return () => {
      isMounted = false
    }
  }, [storage, initialSummary])

  const handleExport = useCallback(async () => {
    // Prevent duplicate simultaneous exports
    if (isExporting) return

    setInternalStatus({ type: 'exporting' })

    try {
      const store = storage || getStorageContext()
      const { payload, filename } = await executeExportBackup({ storage: store })

      // Display accurate counts from the generated backup payload
      const accurateCounts: ExportBackupSummary = {
        trips: payload.trips.length,
        items: payload.items.length,
        templates: payload.templates.length,
      }
      setSummary(accurateCounts)

      setInternalStatus({
        type: 'success',
        filename,
        exportedAt: payload.exportedAt,
        counts: accurateCounts,
      })

      onExportSuccess?.(payload, filename)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setInternalStatus({
        type: 'error',
        error: error.message,
      })
      onExportError?.(error)
    }
  }, [isExporting, storage, onExportSuccess, onExportError])

  return (
    <Card
      variant="scrapbook"
      padding="md"
      className={`border border-sand/40 bg-warm-white shadow-card ${className}`.trim()}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2.5 rounded-card bg-forest-green/10 text-forest-green shrink-0 mt-0.5">
          <HardDriveDownload className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-serif font-bold text-lg text-ink-black tracking-tight">
            Export Local Backup
          </h3>
          <p className="text-sm text-sand-dark leading-relaxed">
            Download a portable, offline-safe snapshot of all your travel data.
          </p>
        </div>
      </div>

      {/* Local Data Summary Counters */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-sand-dark mb-2">
          Current Data Summary
        </p>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
          {/* Trips Stat */}
          <div
            className="p-3 rounded-card bg-sand/15 border border-sand/30 flex flex-col items-center justify-center"
            data-testid="stat-trips"
          >
            <Luggage className="w-4 h-4 text-forest-green mb-1 opacity-80" aria-hidden="true" />
            <span
              className="text-xl sm:text-2xl font-bold text-ink-black font-mono leading-none"
              aria-label={`${summary.trips} Trips`}
            >
              {summary.trips}
            </span>
            <span className="text-[11px] sm:text-xs text-sand-dark mt-1 font-medium">Trips</span>
          </div>

          {/* Checklist Items Stat */}
          <div
            className="p-3 rounded-card bg-sand/15 border border-sand/30 flex flex-col items-center justify-center"
            data-testid="stat-items"
          >
            <CheckSquare className="w-4 h-4 text-terracotta mb-1 opacity-80" aria-hidden="true" />
            <span
              className="text-xl sm:text-2xl font-bold text-ink-black font-mono leading-none"
              aria-label={`${summary.items} Checklist Items`}
            >
              {summary.items}
            </span>
            <span className="text-[11px] sm:text-xs text-sand-dark mt-1 font-medium">
              Items
            </span>
          </div>

          {/* Templates Stat */}
          <div
            className="p-3 rounded-card bg-sand/15 border border-sand/30 flex flex-col items-center justify-center"
            data-testid="stat-templates"
          >
            <Bookmark className="w-4 h-4 text-sunshine-yellow mb-1 opacity-80" aria-hidden="true" />
            <span
              className="text-xl sm:text-2xl font-bold text-ink-black font-mono leading-none"
              aria-label={`${summary.templates} Templates`}
            >
              {summary.templates}
            </span>
            <span className="text-[11px] sm:text-xs text-sand-dark mt-1 font-medium">
              Templates
            </span>
          </div>
        </div>
      </div>

      {/* Explanatory Note on Local-First Security */}
      <div className="flex items-start gap-2.5 p-3 rounded-card bg-sand/10 border border-sand/25 text-xs text-sand-dark leading-relaxed mb-5">
        <ShieldCheck className="w-4 h-4 text-forest-green shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          PackPilot stores data locally in your browser. This backup is a standard JSON file.
          Keep it somewhere safe (such as personal cloud storage or an external drive) so you can
          restore your trips after clearing browser data or when moving to another device.
        </p>
      </div>

      {/* Success Notification */}
      {status.type === 'success' && (
        <div
          role="status"
          aria-live="polite"
          data-testid="export-success-banner"
          className="p-3 mb-5 rounded-card bg-forest-green/10 border border-forest-green/30 text-sm text-forest-green flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-snug">
            <p className="font-semibold text-forest-green">Backup downloaded successfully!</p>
            <p className="text-xs text-forest-green/80 mt-0.5 font-mono">
              {`Saved as ${status.filename} (${status.counts.trips} trips, ${status.counts.items} items, ${status.counts.templates} templates)`}
            </p>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {status.type === 'error' && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="export-error-banner"
          className="p-3 mb-5 rounded-card bg-terracotta/10 border border-terracotta/30 text-sm text-terracotta flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-snug">
            <p className="font-semibold text-terracotta">Export failed</p>
            <p className="text-xs text-terracotta/90 mt-0.5">{status.error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-sand/30">
        <div className="text-xs text-sand-dark">
          {summary.trips === 0 && summary.items === 0 ? (
            <span>No trips recorded yet. An empty backup will be generated.</span>
          ) : (
            <span>{`Ready to package ${summary.trips} trips into JSON.`}</span>
          )}
        </div>

        <Button
          variant="forest"
          size="md"
          onClick={handleExport}
          disabled={isExporting}
          isLoading={isExporting}
          leftIcon={<Download className="w-4 h-4" aria-hidden="true" />}
          className="w-full sm:w-auto font-medium"
          aria-label="Download Backup (.json)"
          data-testid="export-download-btn"
        >
          {isExporting ? 'Exporting Backup...' : 'Download Backup (.json)'}
        </Button>
      </div>
    </Card>
  )
}
