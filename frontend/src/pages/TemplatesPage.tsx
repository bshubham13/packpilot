import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Layers,
  Search,
  X,
  Compass,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react'
import { useTemplateStore } from '../stores/templateStore'
import { Card, Button, Badge } from '../components/ui'
import {
  TemplateCard,
  ViewTemplateModal,
  EditTemplateModal,
  DeleteTemplateConfirmModal,
} from '../components/templates'
import type { PackingTemplate } from '../types'

export type TemplateFilterType = 'all' | 'custom' | 'system'

export function TemplatesPage() {
  const { templates, isLoading, error, loadTemplates } = useTemplateStore()

  const [filter, setFilter] = useState<TemplateFilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [viewingTemplate, setViewingTemplate] = useState<PackingTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<PackingTemplate | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<PackingTemplate | null>(null)

  // Load templates on mount
  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  // Count metrics for tabs
  const totalCount = templates.length
  const customCount = useMemo(() => templates.filter((t) => !t.isSystem).length, [templates])
  const systemCount = useMemo(() => templates.filter((t) => t.isSystem).length, [templates])

  // Filtered and searched templates
  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return templates.filter((template) => {
      // 1. Type filter
      if (filter === 'custom' && template.isSystem) return false
      if (filter === 'system' && !template.isSystem) return false

      // 2. Search query match (name or description)
      if (query) {
        const nameMatch = template.name.toLowerCase().includes(query)
        const descMatch = (template.description || '').toLowerCase().includes(query)
        if (!nameMatch && !descMatch) return false
      }

      return true
    })
  }, [templates, filter, searchQuery])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-fadeIn text-ink-black">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-sand/40 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="stamp" size="sm">
              Library
            </Badge>
            <span className="text-[11px] font-sans text-ink-black/60 uppercase tracking-widest font-semibold">
              Travel Baselines &amp; Kits
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink-black tracking-tight">
            Packing Templates
          </h1>
          <p className="font-sans text-xs sm:text-sm text-ink-black/70 max-w-2xl leading-relaxed">
            Browse curated packing foundations for common destinations or manage your custom travel snapshots.
          </p>
        </div>

        {/* Informational Hint / Save as Template guide */}
        <div className="hidden lg:flex items-center gap-2 p-2.5 rounded-card bg-sand/15 border border-sand/30 text-xs text-ink-black/70 shrink-0 max-w-xs">
          <Sparkles className="w-4 h-4 text-terracotta shrink-0" aria-hidden="true" />
          <span>
            Save custom templates anytime directly from any active trip checklist.
          </span>
        </div>
      </div>

      {/* Error Alert with Retry */}
      {error && (
        <Card variant="polaroid" padding="md" className="border-terracotta/40 bg-red-50 text-red-900 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 text-xs">
              <span className="font-bold text-sm block">Unable to load templates</span>
              <p>{error}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => void loadTemplates()}
          >
            Retry Loading
          </Button>
        </Card>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div
          role="tablist"
          aria-label="Filter templates by type"
          className="flex items-center p-1 rounded-card bg-sand/20 border border-sand/40 self-start"
          data-testid="template-filter-tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-sm font-sans text-xs font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-warm-white text-ink-black shadow-xs'
                : 'text-ink-black/60 hover:text-ink-black'
            }`}
            data-testid="filter-tab-all"
          >
            {`All (${totalCount})`}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'custom'}
            onClick={() => setFilter('custom')}
            className={`px-3 py-1.5 rounded-sm font-sans text-xs font-semibold transition-all cursor-pointer ${
              filter === 'custom'
                ? 'bg-warm-white text-ink-black shadow-xs'
                : 'text-ink-black/60 hover:text-ink-black'
            }`}
            data-testid="filter-tab-custom"
          >
            {`Custom (${customCount})`}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'system'}
            onClick={() => setFilter('system')}
            className={`px-3 py-1.5 rounded-sm font-sans text-xs font-semibold transition-all cursor-pointer ${
              filter === 'system'
                ? 'bg-warm-white text-ink-black shadow-xs'
                : 'text-ink-black/60 hover:text-ink-black'
            }`}
            data-testid="filter-tab-system"
          >
            {`Predefined (${systemCount})`}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search
            className="w-4 h-4 text-ink-black/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-8 py-1.5 bg-warm-white border border-sand/60 rounded-card text-xs text-ink-black placeholder:text-ink-black/40 focus:outline-none focus:ring-2 focus:ring-terracotta"
            data-testid="template-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-black/40 hover:text-ink-black p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && templates.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-terracotta animate-spin mx-auto" aria-hidden="true" />
          <p className="font-serif text-sm text-ink-black/70">
            Loading packing templates...
          </p>
        </div>
      ) : filteredTemplates.length > 0 ? (
        /* Template Cards Grid */
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          data-testid="templates-grid"
        >
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onView={(t) => setViewingTemplate(t)}
              onEdit={(t) => setEditingTemplate(t)}
              onDelete={(t) => setDeletingTemplate(t)}
            />
          ))}
        </div>
      ) : (
        /* Contextual Empty States */
        <div
          className="p-8 sm:p-12 text-center rounded-scrapbook border-2 border-dashed border-sand/60 bg-warm-white/60 space-y-4 max-w-lg mx-auto"
          data-testid="templates-empty-state"
        >
          {searchQuery.trim() ? (
            /* Search yielded no matches */
            <>
              <div className="w-12 h-12 rounded-full bg-sand/20 text-ink-black/60 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-base sm:text-lg text-ink-black">
                  No matching templates found
                </h3>
                <p className="font-sans text-xs text-ink-black/70 leading-relaxed">
                  No templates matched <span className="font-bold">"{searchQuery}"</span>. Try adjusting your search term or clearing filters.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSearchQuery('')}
                data-testid="clear-search-btn"
              >
                Clear Search
              </Button>
            </>
          ) : filter === 'custom' ? (
            /* No custom templates saved yet */
            <>
              <div className="w-12 h-12 rounded-full bg-sand/20 text-terracotta flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-base sm:text-lg text-ink-black">
                  No custom templates yet
                </h3>
                <p className="font-sans text-xs text-ink-black/70 leading-relaxed">
                  Save your curated checklist as a custom template anytime from the trip checklist page.
                </p>
              </div>
              <Link to="/trips">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Compass className="w-3.5 h-3.5" />}
                  data-testid="go-to-trips-btn"
                >
                  View My Trips
                </Button>
              </Link>
            </>
          ) : filter === 'system' ? (
            /* No system templates (fallback) */
            <>
              <div className="w-12 h-12 rounded-full bg-sand/20 text-ink-black/60 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-base sm:text-lg text-ink-black">
                  No predefined templates available
                </h3>
                <p className="font-sans text-xs text-ink-black/70 leading-relaxed">
                  System templates could not be loaded. Please click reload to re-seed defaults.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() => void loadTemplates()}
              >
                Reload Templates
              </Button>
            </>
          ) : (
            /* General empty state */
            <>
              <div className="w-12 h-12 rounded-full bg-sand/20 text-ink-black/60 flex items-center justify-center mx-auto">
                <FolderOpen className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-base sm:text-lg text-ink-black">
                  No packing templates found
                </h3>
                <p className="font-sans text-xs text-ink-black/70 leading-relaxed">
                  There are no templates in your library.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void loadTemplates()}
              >
                Reload Templates
              </Button>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      <ViewTemplateModal
        isOpen={Boolean(viewingTemplate)}
        template={viewingTemplate}
        onClose={() => setViewingTemplate(null)}
      />

      <EditTemplateModal
        isOpen={Boolean(editingTemplate)}
        template={editingTemplate}
        onClose={() => setEditingTemplate(null)}
        onSuccess={async () => {
          await loadTemplates()
          setEditingTemplate(null)
        }}
      />

      <DeleteTemplateConfirmModal
        isOpen={Boolean(deletingTemplate)}
        template={deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        onSuccess={async () => {
          await loadTemplates()
          setDeletingTemplate(null)
        }}
      />
    </div>
  )
}
