import { NavLink, Link } from 'react-router-dom'
import { Compass, Plus } from 'lucide-react'
import { Button } from '../ui'

export function Header() {
  return (
    <header className="border-b border-sand/40 bg-warm-white/90 backdrop-blur sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-3.5 flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Brand Identity / Home Link */}
        <Link
          to="/"
          className="flex items-center gap-2 sm:gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta rounded-card p-0.5 -m-0.5 sm:p-1 sm:-m-1 min-w-0 shrink-0"
          aria-label="PackPilot Home"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-card bg-terracotta text-warm-white flex items-center justify-center shadow-sm group-hover:bg-terracotta-dark transition-colors shrink-0">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:rotate-45" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="font-serif font-bold text-base sm:text-xl tracking-tight text-ink-black block leading-none">
              PackPilot
            </span>
            <span className="text-[10px] sm:text-[11px] font-sans uppercase tracking-wider sm:tracking-widest text-ink-black/60 block leading-tight whitespace-nowrap mt-0.5">
              <span className="hidden sm:inline">Personal Travel Assistant</span>
              <span className="sm:hidden">Travel Assistant</span>
            </span>
          </div>
        </Link>

        {/* Functional Navigation */}
        <nav aria-label="Main Navigation" className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          <NavLink
            to="/trips"
            className={({ isActive }) =>
              `font-sans text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-sm transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta ${
                isActive
                  ? 'text-terracotta font-semibold bg-terracotta/10'
                  : 'text-ink-black/75 hover:text-ink-black hover:bg-sand/20'
              }`
            }
          >
            My Trips
          </NavLink>

          <Link to="/wizard/new" tabIndex={-1}>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs whitespace-nowrap min-h-[30px] sm:min-h-[32px]"
            >
              <span className="hidden sm:inline">Plan a Trip</span>
              <span className="sm:hidden">Plan</span>
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  )
}
