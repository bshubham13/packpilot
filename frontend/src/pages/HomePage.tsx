import { Link } from 'react-router-dom'
import { Plus, Luggage, Sparkles, Shield, Compass } from 'lucide-react'
import { Card, Button, Badge } from '../components/ui'

export function HomePage() {
  return (
    <div className="space-y-8 sm:space-y-10 py-2 sm:py-4">
      {/* Editorial Hero Section */}
      <Card variant="scrapbook" hasTape padding="none" className="p-4 sm:p-8 space-y-4 sm:space-y-6 text-center sm:text-left">
        <div className="space-y-2.5 sm:space-y-3">
          <Badge variant="terracotta" icon={<Sparkles className="w-3.5 h-3.5" />}>
            Your Personal Travel Assistant
          </Badge>
          <h1 className="font-serif text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-ink-black leading-tight sm:leading-tight">
            Pack with Confidence,
            <span className="block sm:inline sm:ml-2">Travel with Ease</span>
          </h1>
          <p className="font-sans text-sm sm:text-base md:text-lg text-ink-black/75 max-w-2xl leading-normal sm:leading-relaxed">
            PackPilot is an offline-capable, local-first packing assistant. We generate tailored,
            categorized packing checklists based on your trip duration, transit modes, planned
            activities, weather, and traveller companions—100% privately in your browser.
          </p>
        </div>

        {/* Primary Functional CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-start gap-2.5 sm:gap-3 pt-1 sm:pt-2">
          <Link to="/wizard/new" className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
              className="w-full sm:w-auto sm:text-base sm:px-6 sm:py-3.5 sm:min-h-[48px]"
            >
              Plan a New Trip
            </Button>
          </Link>
          <Link to="/trips" className="w-full sm:w-auto">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Luggage className="w-4 h-4" aria-hidden="true" />}
              className="w-full sm:w-auto sm:text-base sm:px-6 sm:py-3.5 sm:min-h-[48px]"
            >
              View My Trips
            </Button>
          </Link>
        </div>
      </Card>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-6">
        <Card variant="ticket" padding="none" className="p-4 sm:p-5 space-y-1.5 sm:space-y-2">
          <div className="w-8 h-8 rounded-card bg-terracotta/10 text-terracotta flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <h2 className="font-serif font-bold text-base sm:text-lg text-ink-black">100% Local-First</h2>
          <p className="font-sans text-xs sm:text-sm text-ink-black/70 leading-normal sm:leading-relaxed">
            Your travel plans remain entirely on your device. We use browser IndexedDB with zero cloud tracking.
          </p>
        </Card>

        <Card variant="ticket" padding="none" className="p-4 sm:p-5 space-y-1.5 sm:space-y-2">
          <div className="w-8 h-8 rounded-card bg-forest-green/10 text-forest-green flex items-center justify-center">
            <Compass className="w-4 h-4" />
          </div>
          <h2 className="font-serif font-bold text-base sm:text-lg text-ink-black">Smart Recommendations</h2>
          <p className="font-sans text-xs sm:text-sm text-ink-black/70 leading-normal sm:leading-relaxed">
            Deterministic rules calculate item counts adjusted for laundry rotation, age groups, and duration.
          </p>
        </Card>

        <Card variant="ticket" padding="none" className="p-4 sm:p-5 space-y-1.5 sm:space-y-2">
          <div className="w-8 h-8 rounded-card bg-sunshine-yellow/20 text-ink-black flex items-center justify-center">
            <Luggage className="w-4 h-4" />
          </div>
          <h2 className="font-serif font-bold text-base sm:text-lg text-ink-black">Readiness &amp; Weight</h2>
          <p className="font-sans text-xs sm:text-sm text-ink-black/70 leading-normal sm:leading-relaxed">
            Real-time weighted readiness score (3/2/1) and luggage weight estimation against airline limits.
          </p>
        </Card>
      </div>
    </div>
  )
}
