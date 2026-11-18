import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useTripStore } from '../../stores/tripStore'

export function StorageBanner() {
  const [isDismissed, setIsDismissed] = useState(false)
  const storageType = useTripStore((state) => state.storageType)
  const isStorageAvailable = useTripStore((state) => state.isStorageAvailable)

  // Only display when running in memory mode and not dismissed during this session
  if (storageType !== 'memory' && isStorageAvailable) {
    return null
  }

  if (isDismissed) {
    return null
  }

  return (
    <aside
      role="alert"
      aria-live="polite"
      className="bg-amber-100/95 border-b border-amber-300 text-ink-black px-3 py-2 sm:px-6 sm:py-3 shadow-sm transition-all"
    >
      <div className="max-w-6xl mx-auto flex items-start sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-start sm:items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
          <div className="p-1 rounded-sm bg-amber-200 text-amber-800 shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="text-xs sm:text-sm font-sans leading-normal sm:leading-relaxed flex-1 min-w-0 break-words">
            <strong className="font-semibold block sm:inline">
              Running in In-Memory Mode:{' '}
            </strong>
            <span>
              IndexedDB storage is unavailable or blocked (such as in private browsing).
              Trips and checklist updates will not be saved across browser restarts.
              Export your data as JSON once that feature is available before closing this session.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          aria-label="Dismiss storage warning for this session"
          className="shrink-0 p-1 rounded-sm text-ink-black/60 hover:text-ink-black hover:bg-amber-200/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
