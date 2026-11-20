/**
 * PackPilot — Unified Backup & Restore Modal
 * Milestone 8B-4: Modal container providing tabbed access to Export and Restore workflows.
 * Visual Identity: Travel Scrapbook + Adventure Editorial.
 */

import { useState, useEffect } from 'react'
import { Download, UploadCloud } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { ExportBackupCard } from './ExportBackupCard'
import { RestoreBackupCard } from './RestoreBackupCard'
import type { StorageContext } from '../../db/interfaces'

export type BackupModalTab = 'export' | 'restore'

export interface BackupRestoreModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: BackupModalTab
  storage?: StorageContext
  className?: string
  /**
   * Optional override for testing restore-in-progress UI states deterministically.
   */
  isRestoreInProgressOverride?: boolean
}

export function BackupRestoreModal({
  isOpen,
  onClose,
  initialTab = 'export',
  storage,
  className = '',
  isRestoreInProgressOverride,
}: BackupRestoreModalProps) {
  const [activeTab, setActiveTab] = useState<BackupModalTab>(initialTab)
  const [internalIsRestoreInProgress, setInternalIsRestoreInProgress] = useState<boolean>(false)
  const isRestoreInProgress = isRestoreInProgressOverride ?? internalIsRestoreInProgress

  // Synchronize activeTab when modal is reopened or initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setInternalIsRestoreInProgress(false)
    }
  }, [isOpen, initialTab])

  // Prevent accidental dismissal during active restore execution
  const handleSafeClose = () => {
    if (isRestoreInProgress) {
      return
    }
    onClose()
  }

  // Defensively guard tab switching during active restore execution
  const handleTabChange = (tab: BackupModalTab) => {
    if (isRestoreInProgress) {
      return
    }
    setActiveTab(tab)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSafeClose}
      title="Backup & Restore"
      description="Export your travel records for safekeeping or restore from an existing JSON backup."
      size="lg"
    >
      <div className={`space-y-4 max-h-[75vh] overflow-y-auto px-0.5 ${className}`.trim()}>
        {/* Tab Navigation Switcher */}
        <div
          role="tablist"
          aria-label="Backup and Restore Actions"
          className="flex items-center gap-1.5 p-1 rounded-card bg-sand/20 border border-sand/40"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'export'}
            aria-controls="tabpanel-export"
            id="tab-export"
            disabled={isRestoreInProgress}
            onClick={() => handleTabChange('export')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-card text-xs sm:text-sm font-semibold transition-all select-none ${
              isRestoreInProgress
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
            } ${
              activeTab === 'export'
                ? 'bg-warm-white text-ink-black shadow-xs border border-sand/30'
                : 'text-sand-dark hover:text-ink-black'
            }`}
            data-testid="tab-export-btn"
          >
            <Download className="w-4 h-4 text-forest-green" aria-hidden="true" />
            <span>Export Backup</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'restore'}
            aria-controls="tabpanel-restore"
            id="tab-restore"
            disabled={isRestoreInProgress}
            onClick={() => handleTabChange('restore')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-card text-xs sm:text-sm font-semibold transition-all select-none ${
              isRestoreInProgress
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
            } ${
              activeTab === 'restore'
                ? 'bg-warm-white text-ink-black shadow-xs border border-sand/30'
                : 'text-sand-dark hover:text-ink-black'
            }`}
            data-testid="tab-restore-btn"
          >
            <UploadCloud className="w-4 h-4 text-terracotta" aria-hidden="true" />
            <span>Restore Backup</span>
          </button>
        </div>

        {/* Tab Panels */}
        <div className="pt-1">
          {activeTab === 'export' ? (
            <div
              role="tabpanel"
              id="tabpanel-export"
              aria-labelledby="tab-export"
              data-testid="tabpanel-export"
            >
              <ExportBackupCard storage={storage} />
            </div>
          ) : (
            <div
              role="tabpanel"
              id="tabpanel-restore"
              aria-labelledby="tab-restore"
              data-testid="tabpanel-restore"
            >
              <RestoreBackupCard
                storage={storage}
                onRestoringChange={setInternalIsRestoreInProgress}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
