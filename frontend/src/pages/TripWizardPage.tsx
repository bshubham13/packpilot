import { Link } from 'react-router-dom'
import { ArrowLeft, Sparkles, MapPin } from 'lucide-react'
import { Card, Button, Badge } from '../components/ui'

export function TripWizardPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
      {/* Editorial Header */}
      <div className="space-y-1.5 sm:space-y-2 border-b border-sand/40 pb-3 sm:pb-4">
        <Link
          to="/trips"
          className="inline-flex items-center gap-1.5 text-xs font-sans text-ink-black/60 hover:text-terracotta transition-colors mb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta rounded-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Trips</span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="terracotta" size="sm" icon={<Sparkles className="w-3 h-3" />}>
            Trip Wizard
          </Badge>
          <Badge variant="outline" size="sm">
            Slice 6.3
          </Badge>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink-black">
          Plan a New Journey
        </h1>
        <p className="font-sans text-xs sm:text-sm text-ink-black/70 leading-normal sm:leading-relaxed">
          The 5-step progressive disclosure wizard will capture your itinerary parameters here.
        </p>
      </div>

      {/* Placeholder Overview Card */}
      <Card variant="scrapbook" hasTape className="p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-card bg-terracotta/10 text-terracotta flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-base sm:text-lg text-ink-black">
              5-Step Progressive Disclosure
            </h2>
            <p className="font-sans text-xs text-ink-black/60">
              Captures all travel parameters in under 90 seconds
            </p>
          </div>
        </div>

        <ol className="font-sans text-xs sm:text-sm text-ink-black/75 space-y-2 sm:space-y-2.5 border-l-2 border-terracotta/30 pl-3.5 sm:pl-4 py-0.5 sm:py-1">
          <li className="flex items-start gap-2">
            <strong className="text-terracotta shrink-0">Step 1:</strong>
            <span>Core Basics (Name, Destination, UTC Dates)</span>
          </li>
          <li className="flex items-start gap-2">
            <strong className="text-terracotta shrink-0">Step 2:</strong>
            <span>Transit Modes (Flight, Train, Car, Bike, Bus)</span>
          </li>
          <li className="flex items-start gap-2">
            <strong className="text-terracotta shrink-0">Step 3:</strong>
            <span>Purpose &amp; Activities (Beach, Trekking, Business, etc.)</span>
          </li>
          <li className="flex items-start gap-2">
            <strong className="text-terracotta shrink-0">Step 4:</strong>
            <span>Contextual Climate &amp; Weather</span>
          </li>
          <li className="flex items-start gap-2">
            <strong className="text-terracotta shrink-0">Step 5:</strong>
            <span>Accommodation, Dual Baggage &amp; Traveller Composition</span>
          </li>
        </ol>

        <div className="pt-3 border-t border-sand/30 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <span className="text-xs text-ink-black/50 font-sans text-center sm:text-left">
            Ready for implementation in Slice 6.3
          </span>
          <Link to="/trips" className="w-full sm:w-auto">
            <Button variant="secondary" size="sm" className="w-full sm:w-auto">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
