import { useMemo } from 'react'
import {
  Lock,
  Sparkles,
  Users,
  Scale,
  Package,
  Layers,
  AlertCircle,
  Check,
} from 'lucide-react'
import { Modal, Button, Badge } from '../ui'
import type { PackingTemplate, PackingCategory, ItemPriority } from '../../types'
import { CATEGORY_INFO_MAP, formatWeight } from './categoryHelpers'

function ItemPriorityBadge({ priority }: { priority: ItemPriority }) {
  switch (priority) {
    case 'critical':
      return (
        <Badge
          variant="terracotta"
          size="sm"
          icon={<AlertCircle className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />}
          className="font-bold tracking-wider"
        >
          Critical
        </Badge>
      )
    case 'recommended':
      return (
        <Badge
          variant="forest"
          size="sm"
          icon={<Check className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />}
        >
          Recommended
        </Badge>
      )
    case 'optional':
    default:
      return (
        <Badge variant="sand" size="sm">
          Optional
        </Badge>
      )
  }
}

export interface ViewTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  template: PackingTemplate | null
}

export function ViewTemplateModal({ isOpen, onClose, template }: ViewTemplateModalProps) {
  // Group template items by category
  const categoryGroups = useMemo(() => {
    if (!template?.items) return {}
    const groups: Partial<Record<PackingCategory, typeof template.items>> = {}
    for (const item of template.items) {
      const cat = item.category || 'miscellaneous'
      if (!groups[cat]) {
        groups[cat] = []
      }
      groups[cat]!.push(item)
    }
    return groups
  }, [template])

  if (!isOpen || !template) return null

  const itemCount = template.items?.length ?? 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={template.name}
      size="lg"
    >
      <div className="space-y-4" data-testid="view-template-modal-content">
        {/* System vs Custom Read-Only Identification Banner */}
        {template.isSystem ? (
          <div
            className="p-3 rounded-card bg-sand/20 border border-sand/40 flex items-start gap-2.5 text-ink-black"
            data-testid="system-template-banner"
          >
            <Lock className="w-4 h-4 text-ink-black/70 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-ink-black flex items-center gap-1.5">
                <span>Predefined System Template</span>
                <Badge variant="stamp" size="sm" className="text-[10px] py-0 px-1.5">
                  Read-Only
                </Badge>
              </div>
              <p className="text-ink-black/70">
                This is a curated built-in template designed for optimal travel baselines. It cannot be modified or deleted.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="p-3 rounded-card bg-sand/15 border border-sand/30 flex items-start gap-2.5 text-ink-black"
            data-testid="custom-template-banner"
          >
            <Sparkles className="w-4 h-4 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-ink-black flex items-center gap-1.5">
                <span>Custom Travel Template</span>
                <Badge variant="sand" size="sm" className="text-[10px] py-0 px-1.5">
                  User Created
                </Badge>
              </div>
              <p className="text-ink-black/70">
                Created from your travel checklist.
              </p>
            </div>
          </div>
        )}

        {/* Description & Travel Context Metadata */}
        <div className="space-y-2">
          {template.description ? (
            <p className="font-sans text-xs sm:text-sm text-ink-black/80 leading-relaxed" data-testid="template-detail-description">
              {template.description}
            </p>
          ) : (
            <p className="font-sans text-xs text-ink-black/40 italic" data-testid="template-detail-description">
              No description provided.
            </p>
          )}

          {/* Context badges (climate, transport, activities) if present */}
          {(template.defaultClimate || template.defaultTransport?.length || template.defaultActivities?.length || template.defaultAccommodation) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              {template.defaultClimate && (
                <Badge variant="outline" size="sm" className="capitalize text-[11px] bg-sand/15 border-sand/40">
                  {`Climate: ${template.defaultClimate}`}
                </Badge>
              )}
              {template.defaultAccommodation && (
                <Badge variant="outline" size="sm" className="capitalize text-[11px] bg-sand/15 border-sand/40">
                  {`Stay: ${template.defaultAccommodation}`}
                </Badge>
              )}
              {template.defaultTransport?.map((mode) => (
                <Badge key={mode} variant="outline" size="sm" className="capitalize text-[11px] bg-sand/15 border-sand/40">
                  {mode}
                </Badge>
              ))}
              {template.defaultActivities?.map((act) => (
                <Badge key={act} variant="outline" size="sm" className="capitalize text-[11px] bg-sand/15 border-sand/40">
                  {act}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Items Section Header */}
        <div className="flex items-center justify-between pt-2 border-t border-sand/30">
          <span className="font-serif font-bold text-sm text-ink-black flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-terracotta" aria-hidden="true" />
            <span>Saved Template Items</span>
          </span>
          <span className="font-sans text-xs text-ink-black/60 font-medium">
            {`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
          </span>
        </div>

        {/* Grouped Items or Empty State */}
        {itemCount === 0 ? (
          <div
            className="py-12 px-4 text-center rounded-card border border-dashed border-sand/60 bg-sand/10 space-y-2"
            data-testid="template-empty-state"
          >
            <Package className="w-8 h-8 text-sand mx-auto" aria-hidden="true" />
            <h4 className="font-serif font-bold text-sm text-ink-black">No items in this template</h4>
            <p className="font-sans text-xs text-ink-black/60 max-w-sm mx-auto">
              This template does not have any items saved yet.
            </p>
          </div>
        ) : (
          <div
            className="max-h-[50vh] overflow-y-auto space-y-3 pr-1"
            data-testid="template-items-container"
          >
            {Object.entries(categoryGroups).map(([catKey, items]) => {
              const cat = catKey as PackingCategory
              const categoryInfo = CATEGORY_INFO_MAP[cat]
              const IconComponent = categoryInfo?.icon || Package
              const categoryLabel = categoryInfo?.label || cat

              return (
                <div
                  key={cat}
                  className="rounded-card border border-sand/40 bg-warm-white overflow-hidden shadow-xs"
                  data-testid={`category-group-${cat}`}
                >
                  {/* Category Group Header */}
                  <div className="bg-sand/15 px-3 py-2 border-b border-sand/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="w-4 h-4 text-terracotta" aria-hidden="true" />
                      <span className="font-serif font-bold text-xs sm:text-sm text-ink-black">
                        {categoryLabel}
                      </span>
                    </div>
                    <span className="font-sans text-[11px] text-ink-black/60 font-medium">
                      {`${items?.length ?? 0} ${(items?.length ?? 0) === 1 ? 'item' : 'items'}`}
                    </span>
                  </div>

                  {/* Item List */}
                  <ul className="divide-y divide-sand/20">
                    {items?.map((item) => {
                      const weightDisplay = formatWeight(item.weightGrams)
                      return (
                        <li
                          key={item.itemSlug}
                          className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs"
                          data-testid={`template-item-${item.itemSlug}`}
                        >
                          {/* Item Info */}
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-ink-black truncate">
                                {item.name}
                              </span>
                              <span className="font-bold text-terracotta text-xs">
                                {`×${item.defaultQuantity}`}
                              </span>
                            </div>

                            {/* Reasons / metadata notes */}
                            {item.reasons && item.reasons.length > 0 && (
                              <p className="text-[11px] text-ink-black/50 truncate">
                                {item.reasons[0]}
                              </p>
                            )}
                          </div>

                          {/* Item Badges (Priority, Weight, Shared) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.isShared && (
                              <Badge
                                variant="outline"
                                size="sm"
                                icon={<Users className="w-2.5 h-2.5 text-forest-green" aria-hidden="true" />}
                                className="text-[10px] py-0.5 px-1.5 border-forest-green/30 text-forest-green bg-forest-green/5"
                              >
                                Shared
                              </Badge>
                            )}

                            {weightDisplay && (
                              <Badge
                                variant="outline"
                                size="sm"
                                icon={<Scale className="w-2.5 h-2.5 text-ink-black/50" aria-hidden="true" />}
                                className="text-[10px] py-0.5 px-1.5 border-sand/50 text-ink-black/70 bg-sand/15"
                              >
                                {weightDisplay}
                              </Badge>
                            )}

                            <ItemPriorityBadge priority={item.priority} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal Footer / Close Action */}
        <div className="pt-3 flex items-center justify-end border-t border-sand/30">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            data-testid="close-view-template-modal-btn"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
