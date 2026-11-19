import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Compass, AlertCircle, RefreshCw } from 'lucide-react'
import { useTripStore } from './stores/tripStore'
import { Layout } from './components/layout'
import { HomePage, TripDashboardPage, TripWizardPage, ChecklistPage } from './pages'
import { Button, Card, Badge } from './components/ui'
import './App.css'

export function App() {
  const isInitialized = useTripStore((state) => state.isInitialized)
  const error = useTripStore((state) => state.error)
  const initialize = useTripStore((state) => state.initialize)

  // Initialize storage once at the application root
  useEffect(() => {
    initialize()
  }, [initialize])

  // Initializing state (first mount probe and load)
  if (!isInitialized) {
    if (error) {
      return (
        <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
          <Card variant="polaroid" hasTape className="max-w-md w-full text-center space-y-5 p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <Badge variant="terracotta" size="sm">
                Storage Initialization Issue
              </Badge>
              <h1 className="font-serif font-bold text-xl text-ink-black">
                Unable to Open Travel Journal
              </h1>
              <p className="font-sans text-xs sm:text-sm text-ink-black/70 leading-relaxed">
                {error}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() => initialize()}
              >
                Retry
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => initialize('memory')}
              >
                Continue in Session Mode
              </Button>
            </div>
          </Card>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm mx-auto">
          <div className="w-14 h-14 rounded-card bg-terracotta text-warm-white flex items-center justify-center mx-auto shadow-md animate-pulse">
            <Compass className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="font-serif font-bold text-2xl text-ink-black tracking-tight">
              PackPilot
            </h1>
            <p className="font-sans text-xs text-ink-black/60">
              Initializing your personal travel journal...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/trips" element={<TripDashboardPage />} />
          <Route path="/wizard/new" element={<TripWizardPage />} />
          <Route path="/trips/:id" element={<ChecklistPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}

export default App
