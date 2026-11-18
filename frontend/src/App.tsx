import { useState } from 'react'
import {
  Compass,
  MapPin,
  Luggage,
  Sparkles,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react'
import { Button, Badge, Card } from './components/ui'
import { COLORS } from './tokens'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  const colorTokens = [
    { name: 'Warm Cream', hex: COLORS.warmCream, role: 'Canvas Background', textDark: true },
    { name: 'Warm White', hex: COLORS.warmWhite, role: 'Cards & Surfaces', textDark: true },
    { name: 'Terracotta', hex: COLORS.terracotta, role: 'Primary Accent & CTAs', textDark: false },
    { name: 'Dark Terracotta', hex: COLORS.terracottaDark, role: 'Deep CTA & Active', textDark: false },
    { name: 'Sunshine Yellow', hex: COLORS.sunshineYellow, role: 'Highlights & Badges', textDark: true },
    { name: 'Ink Black', hex: COLORS.inkBlack, role: 'Editorial Typography', textDark: false },
    { name: 'Sand', hex: COLORS.sand, role: 'Subtle Borders & Lines', textDark: true },
    { name: 'Forest Green', hex: COLORS.forestGreen, role: 'Adventure Accents', textDark: false },
  ]

  return (
    <div className="min-h-screen bg-warm-cream text-ink-black selection:bg-terracotta selection:text-warm-white">
      {/* Top Identity Bar */}
      <header className="border-b border-sand/40 bg-warm-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-card bg-terracotta text-warm-white flex items-center justify-center shadow-sm">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <span className="font-serif font-bold text-xl tracking-tight text-ink-black block leading-none">
                PackPilot
              </span>
              <span className="text-[11px] font-sans text-sand-700 uppercase tracking-widest text-ink-black/60">
                Design System v1.0
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="stamp" size="sm">
              Scrapbook + Editorial
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {/* Editorial Header */}
        <section className="text-center sm:text-left space-y-3">
          <Badge variant="terracotta" icon={<Sparkles className="w-3.5 h-3.5" />}>
            Official Visual Identity
          </Badge>
          <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-ink-black">
            Travel Scrapbook &amp; Adventure Editorial
          </h1>
          <p className="font-sans text-base sm:text-lg text-ink-black/75 max-w-2xl leading-relaxed">
            A cohesive design foundation for PackPilot: tactile paper textures, warm earthy tones,
            adventurous accents, and refined editorial typography for your personal travel assistant.
          </p>
        </section>

        {/* Color Palette Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-sand/30 pb-2">
            <h2 className="font-serif text-2xl font-bold text-ink-black flex items-center gap-2">
              <Layers className="w-5 h-5 text-terracotta" />
              Design Tokens: Color Palette
            </h2>
            <span className="text-xs text-ink-black/60 font-sans">8 Core Brand Swatches</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
            {colorTokens.map((c) => (
              <div
                key={c.name}
                className="bg-warm-white p-2.5 rounded-card border border-sand/40 shadow-sm flex flex-col justify-between"
              >
                <div
                  className="w-full h-16 rounded-sm shadow-inner border border-black/5"
                  style={{ backgroundColor: c.hex }}
                />
                <div className="mt-2.5 text-left">
                  <p className="font-sans font-semibold text-xs text-ink-black truncate">
                    {c.name}
                  </p>
                  <p className="font-mono text-[11px] text-ink-black/60 uppercase">{c.hex}</p>
                  <p className="font-sans text-[10px] text-ink-black/50 mt-1 line-clamp-1">
                    {c.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Typography Conventions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-sand/30 pb-2">
            <h2 className="font-serif text-2xl font-bold text-ink-black">
              Typography Conventions
            </h2>
            <span className="text-xs text-ink-black/60 font-sans">Playfair Display &amp; DM Sans</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="scrapbook" padding="md" className="space-y-4">
              <span className="text-xs uppercase tracking-widest text-terracotta font-semibold">
                Headings: Playfair Display
              </span>
              <div className="space-y-2">
                <p className="font-serif text-3xl font-bold text-ink-black">
                  Display Heading 1
                </p>
                <p className="font-serif text-2xl font-semibold text-ink-black">
                  Editorial Heading 2
                </p>
                <p className="font-serif text-xl font-medium text-ink-black">
                  Sub-heading &amp; Section Titles 3
                </p>
                <p className="font-serif italic text-lg text-ink-black/80">
                  &ldquo;A journey of a thousand miles begins with a single pack.&rdquo;
                </p>
              </div>
            </Card>

            <Card variant="scrapbook" padding="md" className="space-y-4">
              <span className="text-xs uppercase tracking-widest text-forest-green font-semibold">
                Body &amp; UI: DM Sans
              </span>
              <div className="space-y-2">
                <p className="font-sans text-base text-ink-black leading-relaxed">
                  Regular Body: Clean, readable geometry optimized for passports, gear checklists,
                  and mobile journey itineraries across all viewport sizes.
                </p>
                <p className="font-sans text-sm text-ink-black/75">
                  Small UI text: Crisp metadata, labels, baggage weight indicators, and timestamps.
                </p>
                <p className="font-sans text-xs tracking-wider uppercase font-semibold text-ink-black/60">
                  Microcopy / Overline / Status text
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* Button Styles & Interactive Working Functionality */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-sand/30 pb-2">
            <h2 className="font-serif text-2xl font-bold text-ink-black">
              Reusable Button Styles
            </h2>
            <span className="text-xs text-ink-black/60 font-sans">Variants, Sizes &amp; States</span>
          </div>

          <div className="space-y-6">
            {/* Variants grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="forest">Forest</Button>
              <Button variant="sunshine">Sunshine</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="stamp">Stamp</Button>
              <Button variant="ghost">Ghost</Button>
            </div>

            {/* Interactive Working Counter Card (Preserving existing working functionality) */}
            <Card variant="ticket" padding="md" className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="forest" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                      Working Interactive State
                    </Badge>
                  </div>
                  <h3 className="font-serif text-lg font-bold text-ink-black">
                    Interactive Counter Test
                  </h3>
                  <p className="text-sm text-ink-black/70">
                    Existing functionality preserved: test button click events and reactive state.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setCount((c) => c + 1)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Count is: {count}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={count === 0}
                    onClick={() => setCount(0)}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </Card>

            {/* Sizes & Icons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm" leftIcon={<MapPin className="w-3.5 h-3.5" />}>
                Small Button
              </Button>
              <Button variant="primary" size="md" leftIcon={<Luggage className="w-4 h-4" />}>
                Medium Button
              </Button>
              <Button variant="primary" size="lg" leftIcon={<Compass className="w-5 h-5" />}>
                Large Expedition
              </Button>
              <Button variant="primary" size="md" isLoading>
                Loading
              </Button>
              <Button variant="secondary" size="md" disabled>
                Disabled
              </Button>
            </div>
          </div>
        </section>

        {/* Scrapbook Cards & Layout Utilities */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-sand/30 pb-2">
            <h2 className="font-serif text-2xl font-bold text-ink-black">
              Scrapbook &amp; Editorial UI Utilities
            </h2>
            <span className="text-xs text-ink-black/60 font-sans">Card Primitives &amp; Badges</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {/* Polaroid card with scrapbook tape */}
            <Card variant="polaroid" padding="md" hasTape className="mt-3">
              <div className="w-full h-36 bg-sand/20 rounded-sm border border-sand/30 flex items-center justify-center text-ink-black/50">
                <Compass className="w-10 h-10 text-terracotta/60" />
              </div>
              <div className="mt-4 text-center">
                <p className="font-serif font-bold text-ink-black">Alps Trek 2026</p>
                <p className="font-sans text-xs text-ink-black/60">Polaroid frame + Scrapbook tape</p>
              </div>
            </Card>

            {/* Ticket Card */}
            <Card variant="ticket" padding="md" className="flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="sunshine" size="sm">
                    Boarding Pass
                  </Badge>
                  <span className="font-mono text-xs text-ink-black/50">PKT-409</span>
                </div>
                <h4 className="font-serif font-bold text-lg text-ink-black">Kyoto &bull; Tokyo</h4>
                <p className="font-sans text-xs text-ink-black/70">
                  Dashed scrapbook ticket container with custom borders and typography tokens.
                </p>
              </div>
              <div className="pt-4 border-t border-dashed border-sand/60 flex items-center justify-between text-xs text-ink-black/70">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> 7 Days
                </span>
                <span className="font-semibold text-terracotta">Ready to Pack</span>
              </div>
            </Card>

            {/* Scrapbook Card */}
            <Card variant="scrapbook" padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="forest" size="sm">
                  Gear Checklist
                </Badge>
                <Bookmark className="w-4 h-4 text-sand" />
              </div>
              <h4 className="font-serif font-bold text-lg text-ink-black">Scrapbook Surface</h4>
              <p className="font-sans text-xs text-ink-black/70 leading-relaxed">
                Warm white surface with soft drop shadow, border tint, and smooth transitions
                compatible with mobile and desktop.
              </p>
              <div className="pt-2 flex flex-wrap gap-1.5">
                <Badge variant="sand" size="sm">
                  Hiking
                </Badge>
                <Badge variant="terracotta" size="sm">
                  Warm Layer
                </Badge>
                <Badge variant="stamp" size="sm">
                  Verified
                </Badge>
              </div>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-sand/40 bg-warm-white/60 mt-16 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-black/60">
          <p className="font-sans">
            PackPilot &bull; Built with React 19, TypeScript, Vite &amp; Tailwind CSS.
          </p>
          <p className="font-sans">
            GitHub Pages compatible &bull; Frontend-only architecture
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
