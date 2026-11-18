import { type ReactNode } from 'react'
import { Header } from './Header'
import { StorageBanner } from './StorageBanner'
import { useTripStore } from '../../stores/tripStore'
import { Badge } from '../ui'
import { Database, ShieldCheck } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const storageType = useTripStore((state) => state.storageType)
  const isStorageAvailable = useTripStore((state) => state.isStorageAvailable)

  return (
    <div className="min-h-screen bg-warm-cream text-ink-black flex flex-col font-sans selection:bg-terracotta selection:text-warm-white overflow-x-hidden w-full max-w-full">
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-terracotta focus:text-warm-white focus:rounded-card focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ink-black font-sans text-sm font-semibold"
      >
        Skip to main content
      </a>

      {/* Persistence / In-Memory Status Notification */}
      <StorageBanner />

      {/* Main Brand & Navigation Header */}
      <Header />

      {/* Primary Main Content Area */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-8 focus:outline-none"
      >
        {children}
      </main>

      {/* Tactile Travel Scrapbook Footer */}
      <footer className="border-t border-sand/40 bg-warm-white/60 py-5 sm:py-6 mt-8 sm:mt-12 transition-colors">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs text-ink-black/60">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-center sm:text-left">
            <span className="font-serif font-bold text-ink-black/80">PackPilot</span>
            <span>—</span>
            <span>Your Personal Travel Packing Assistant</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {storageType === 'indexeddb' && isStorageAvailable ? (
              <Badge variant="outline" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5 text-forest-green" />}>
                IndexedDB Local-First
              </Badge>
            ) : (
              <Badge variant="stamp" size="sm" icon={<Database className="w-3.5 h-3.5 text-amber-700" />}>
                In-Memory Session
              </Badge>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
