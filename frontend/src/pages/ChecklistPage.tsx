import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Luggage, Scale, Layers } from 'lucide-react'
import { Card, Button, Badge } from '../components/ui'

export function ChecklistPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="space-y-1.5 sm:space-y-2 border-b border-sand/40 pb-3 sm:pb-4">
        <Link
          to="/trips"
          className="inline-flex items-center gap-1.5 text-xs font-sans text-ink-black/60 hover:text-terracotta transition-colors mb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta rounded-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Trips</span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="terracotta" size="sm">
            Checklist View
          </Badge>
          <Badge variant="outline" size="sm">
            Slice 6.4
          </Badge>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink-black">
          Trip Packing Checklist
        </h1>
        <p className="font-mono text-xs text-ink-black/60 truncate">
          {`Trip Reference ID: ${id || 'unknown'}`}
        </p>
      </div>

      {/* Placeholder Overview Card */}
      <Card variant="scrapbook" hasTape className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="space-y-1.5 sm:space-y-2">
          <h2 className="font-serif font-bold text-lg sm:text-xl text-ink-black">
            Interactive Packing Experience
          </h2>
          <p className="font-sans text-xs sm:text-sm text-ink-black/75 leading-normal sm:leading-relaxed">
            This view will render categorized packing accordions, triple-quantity state, and
            real-time mathematical scoring widgets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 sm:pt-2">
          <div className="bg-warm-white p-3.5 rounded-sm border border-sand/30 space-y-1.5">
            <Layers className="w-4 h-4 text-terracotta" />
            <h3 className="font-serif font-semibold text-sm text-ink-black">Category Accordions</h3>
            <p className="font-sans text-xs text-ink-black/60">
              Documents, Clothing, Toiletries, Electronics, Gear, Health &amp; Misc.
            </p>
          </div>

          <div className="bg-warm-white p-3.5 rounded-sm border border-sand/30 space-y-1.5">
            <CheckCircle2 className="w-4 h-4 text-forest-green" />
            <h3 className="font-serif font-semibold text-sm text-ink-black">Readiness Score</h3>
            <p className="font-sans text-xs text-ink-black/60">
              Weighted 3/2/1 formula with critical item alert banners.
            </p>
          </div>

          <div className="bg-warm-white p-3.5 rounded-sm border border-sand/30 space-y-1.5">
            <Scale className="w-4 h-4 text-sunshine-yellow" />
            <h3 className="font-serif font-semibold text-sm text-ink-black">Weight Estimator</h3>
            <p className="font-sans text-xs text-ink-black/60">
              Dual baggage evaluation against cabin and checked limits.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-sand/30 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <span className="text-xs text-ink-black/50 font-sans text-center sm:text-left">
            Ready for implementation in Slice 6.4
          </span>
          <Link to="/trips" className="w-full sm:w-auto">
            <Button variant="secondary" size="sm" leftIcon={<Luggage className="w-3.5 h-3.5" />} className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
