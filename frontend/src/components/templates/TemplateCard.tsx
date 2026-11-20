import { useMemo } from 'react'
import { Lock, Sparkles, Layers, Eye, Edit3, Trash2 } from 'lucide-react'
import { Card, Badge, Button } from '../ui'
import type { PackingTemplate, PackingCategory } from '../../types'
import { CATEGORY_INFO_MAP } from './categoryHelpers'

export interface TemplateCardProps {
  template: PackingTemplate
  onView?: (template: PackingTemplate) => void
  onEdit?: (template: PackingTemplate) => void
  onDelete?: (template: PackingTemplate) => void
  className?: string
}

export function TemplateCard({
  template,
  onView,
  onEdit,
  onDelete,
  className = '',
}: TemplateCardProps) {
  const itemCount = template.items?.length ?? 0

  // Extract unique categories present in the template items
  const uniqueCategories = useMemo(() => {
    if (!template.items) return []
    const seen = new Set<PackingCategory>()
    const categories: PackingCategory[] = []
    for (const item of template.items) {
      const cat = item.category || 'miscellaneous'
      if (!seen.has(cat)) {
        seen.add(cat)
        categories.push(cat)
      }
    }
    return categories
  }, [template.items])

  return (
    <Card
      variant="scrapbook"
      padding="md"
      className={`flex flex-col justify-between transition-shadow hover:shadow-polaroid ${
        template.isSystem ? 'border-sand/60 bg-warm-white/95' : 'bg-warm-white'
      } ${className}`.trim()}
      data-testid={`template-card-${template.id}`}
    >
      <div className="space-y-3">
        {/* Header: Badges & System Distinction */}
        <div className="flex items-start justify-between gap-2">
          {template.isSystem ? (
            <Badge
              variant="stamp"
              size="sm"
              icon={<Lock className="w-3 h-3 text-ink-black" aria-hidden="true" />}
              data-testid="template-system-badge"
            >
              Predefined
            </Badge>
          ) : (
            <Badge
              variant="sand"
              size="sm"
              icon={<Sparkles className="w-3 h-3 text-terracotta" aria-hidden="true" />}
              data-testid="template-custom-badge"
            >
              Custom
            </Badge>
          )}

          <span
            className="font-sans text-xs font-medium text-ink-black/60 bg-sand/20 px-2 py-0.5 rounded-full"
            data-testid="template-item-count"
          >
            {`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
          </span>
        </div>

        {/* Title & Description */}
        <div>
          <h3 className="font-serif font-bold text-base sm:text-lg text-ink-black leading-snug">
            {template.name}
          </h3>
          {template.description ? (
            <p className="font-sans text-xs text-ink-black/70 mt-1 line-clamp-2 leading-relaxed">
              {template.description}
            </p>
          ) : (
            <p className="font-sans text-xs text-ink-black/40 italic mt-1">
              No description provided.
            </p>
          )}
        </div>

        {/* Category Indicators */}
        {uniqueCategories.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-semibold text-ink-black/50 uppercase tracking-wider block">
              Categories
            </span>
            <div className="flex flex-wrap gap-1.5" data-testid="template-categories">
              {uniqueCategories.slice(0, 4).map((cat) => {
                const info = CATEGORY_INFO_MAP[cat]
                const IconComponent = info?.icon || Layers
                return (
                  <Badge
                    key={cat}
                    variant="outline"
                    size="sm"
                    icon={<IconComponent className="w-2.5 h-2.5 text-ink-black/60" aria-hidden="true" />}
                    className="capitalize text-[10px] py-0.5 px-2 bg-sand/10 border-sand/40"
                  >
                    {info?.label || cat}
                  </Badge>
                )
              })}
              {uniqueCategories.length > 4 && (
                <span className="text-[10px] text-ink-black/50 font-medium self-center pl-0.5">
                  +{uniqueCategories.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card Action */}
      <div className="pt-4 mt-3 border-t border-sand/30 flex items-center justify-between gap-2">
        {template.isSystem ? (
          <span className="text-[11px] font-sans text-ink-black/50 italic flex items-center gap-1">
            <Lock className="w-3 h-3 text-ink-black/40" aria-hidden="true" />
            Immutable
          </span>
        ) : (
          <span className="text-[11px] font-sans text-ink-black/50">
            Personal template
          </span>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Eye className="w-3.5 h-3.5 text-ink-black/70" aria-hidden="true" />}
            onClick={() => onView?.(template)}
            data-testid={`view-template-btn-${template.id}`}
          >
            View Details
          </Button>

          {!template.isSystem && onEdit && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Edit3 className="w-3.5 h-3.5 text-ink-black/70" aria-hidden="true" />}
              onClick={() => onEdit(template)}
              data-testid={`edit-template-btn-${template.id}`}
            >
              Edit
            </Button>
          )}

          {!template.isSystem && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(template)}
              aria-label={`Delete ${template.name}`}
              className="text-red-700 hover:text-red-800 hover:bg-red-50 p-1.5"
              data-testid={`delete-template-btn-${template.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
