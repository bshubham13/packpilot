import { useState, useEffect, useMemo } from 'react'
import {
  Layers,
  Sparkles,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Info,
  Loader2,
} from 'lucide-react'
import { Modal, Button, Badge } from '../ui'
import { useTemplateStore } from '../../stores/templateStore'
import { useChecklistStore } from '../../stores/checklistStore'
import { applyTemplateToChecklist, type ApplyTemplateResult } from '../../engine'
import type {
  PackingTemplate,
  PackingItem,
  DismissedItemRecord,
  PackingCategory,
} from '../../types'

export interface ApplyTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: string
  existingItems: PackingItem[]
  dismissedRecords: DismissedItemRecord[]
  onApplySuccess?: (result: ApplyTemplateResult, template: PackingTemplate) => void
}

export function ApplyTemplateModal({
  isOpen,
  onClose,
  tripId,
  existingItems,
  dismissedRecords,
  onApplySuccess,
}: ApplyTemplateModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCategoryExpanded, setIsCategoryExpanded] = useState<Record<string, boolean>>({})

  const { templates, loadTemplates, isLoading: isLoadingTemplates } = useTemplateStore()
  const { applyTemplate } = useChecklistStore()

  // Load templates on modal open
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplateId(null)
      setError(null)
      setIsApplying(false)
      setIsCategoryExpanded({})
      void loadTemplates()
    }
  }, [isOpen, loadTemplates])

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null
  }, [templates, selectedTemplateId])

  // Pure preview calculation using applyTemplateToChecklist without mutating state
  const previewResult = useMemo<ApplyTemplateResult | null>(() => {
    if (!selectedTemplate) return null
    return applyTemplateToChecklist(selectedTemplate, {
      tripId,
      existingItems,
      dismissedRecords,
    })
  }, [selectedTemplate, tripId, existingItems, dismissedRecords])

  // Group template items by category for the item breakdown
  const categoryGroups = useMemo(() => {
    if (!selectedTemplate) return {}
    const groups: Partial<Record<PackingCategory, typeof selectedTemplate.items>> = {}
    for (const item of selectedTemplate.items) {
      const cat = item.category || 'miscellaneous'
      if (!groups[cat]) {
        groups[cat] = []
      }
      groups[cat]!.push(item)
    }
    return groups
  }, [selectedTemplate])

  const toggleCategory = (category: string) => {
    setIsCategoryExpanded((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  const handleApply = async () => {
    if (!selectedTemplate || isApplying) return

    setIsApplying(true)
    setError(null)

    try {
      const result = await applyTemplate(selectedTemplate)
      if (onApplySuccess) {
        onApplySuccess(result, selectedTemplate)
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply template. Please try again.')
    } finally {
      setIsApplying(false)
    }
  }

  const handleGuardedClose = () => {
    if (isApplying) return
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleGuardedClose}
      size="lg"
      title="Apply Packing Template"
      description="Select a predefined or custom packing template to enrich this journey's checklist."
    >
      <div className="space-y-4 text-ink-black" data-testid="apply-template-dialog">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-card bg-red-50 border border-terracotta/40 text-xs text-red-900 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Templates State */}
        {isLoadingTemplates && templates.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-terracotta mx-auto" aria-hidden="true" />
            <p className="font-serif text-sm text-ink-black/70">Loading available templates...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Template Selection List */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink-black uppercase tracking-wider">
                Choose Template
              </label>
              <div
                role="radiogroup"
                aria-label="Available templates"
                className="space-y-2 max-h-[320px] overflow-y-auto pr-1"
              >
                {templates.map((tpl) => {
                  const isSelected = tpl.id === selectedTemplateId
                  return (
                    <div
                      key={tpl.id}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault()
                          setSelectedTemplateId(tpl.id)
                        }
                      }}
                      className={`p-3 rounded-card border text-left cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-terracotta ${
                        isSelected
                          ? 'bg-sand/20 border-terracotta shadow-xs'
                          : 'bg-warm-white border-sand/50 hover:border-sand hover:bg-sand/10'
                      }`}
                      data-testid={`template-card-${tpl.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-serif font-bold text-sm text-ink-black flex items-center gap-1.5">
                          <span>{tpl.name}</span>
                          {tpl.isSystem ? (
                            <Badge variant="outline" size="sm" className="text-[10px] px-1.5 py-0">
                              System
                            </Badge>
                          ) : (
                            <Badge variant="sand" size="sm" className="text-[10px] px-1.5 py-0">
                              Custom
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] font-sans text-ink-black/60 shrink-0 font-medium">
                          {`${tpl.items.length} items`}
                        </span>
                      </div>
                      {tpl.description && (
                        <p className="font-sans text-xs text-ink-black/70 line-clamp-2 mt-1">
                          {tpl.description}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Column: Preview & Breakdown */}
            <div className="space-y-3 bg-sand/10 p-3.5 rounded-card border border-sand/40 flex flex-col justify-between">
              {selectedTemplate && previewResult ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-serif font-bold text-sm text-ink-black flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-terracotta" aria-hidden="true" />
                      <span>{selectedTemplate.name}</span>
                    </h4>
                    {selectedTemplate.description && (
                      <p className="text-xs text-ink-black/70 mt-0.5 leading-snug">
                        {selectedTemplate.description}
                      </p>
                    )}
                  </div>

                  {/* Impact Summary Pill Grid */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-ink-black/80 uppercase tracking-wide">
                      Checklist Impact Preview
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-2 rounded-sm bg-forest-green/10 border border-forest-green/20">
                        <div className="font-bold text-sm text-forest-green">
                          {`+${previewResult.addedCount}`}
                        </div>
                        <div className="text-[10px] text-ink-black/70 font-medium">To Add</div>
                      </div>
                      <div className="p-2 rounded-sm bg-sand/30 border border-sand/50">
                        <div className="font-bold text-sm text-ink-black">
                          {`${previewResult.mergedCount}`}
                        </div>
                        <div className="text-[10px] text-ink-black/70 font-medium">To Merge</div>
                      </div>
                      <div className="p-2 rounded-sm bg-sand/20 border border-sand/40">
                        <div className="font-bold text-sm text-ink-black/60">
                          {`${previewResult.skippedDismissedCount}`}
                        </div>
                        <div className="text-[10px] text-ink-black/60 font-medium">Dismissed</div>
                      </div>
                    </div>
                  </div>

                  {previewResult.addedCount === 0 && previewResult.mergedCount === 0 && (
                    <div className="p-2 rounded-sm bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>All template items are already present on your checklist.</span>
                    </div>
                  )}

                  {/* Category Items Accordion */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-semibold text-ink-black/80 uppercase tracking-wide">
                      Items Breakdown by Category
                    </span>
                    <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1">
                      {Object.entries(categoryGroups).map(([cat, catItems]) => {
                        const isExpanded = isCategoryExpanded[cat] ?? false
                        return (
                          <div key={cat} className="rounded-sm border border-sand/40 bg-warm-white">
                            <button
                              type="button"
                              onClick={() => toggleCategory(cat)}
                              className="w-full px-2.5 py-1.5 flex items-center justify-between text-xs font-semibold text-ink-black capitalize hover:bg-sand/15 transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-ink-black/60" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-ink-black/60" />
                                )}
                                <span>{cat}</span>
                              </span>
                              <span className="text-[10px] text-ink-black/60 font-normal">
                                {`${catItems?.length} items`}
                              </span>
                            </button>
                            {isExpanded && catItems && (
                              <ul className="px-3 pb-2 pt-0.5 space-y-0.5 text-[11px] text-ink-black/80 border-t border-sand/30">
                                {catItems.map((ci) => (
                                  <li
                                    key={ci.itemSlug}
                                    className="flex items-center justify-between py-0.5"
                                  >
                                    <span>{ci.name}</span>
                                    <span className="text-ink-black/50 text-[10px]">
                                      {`×${ci.defaultQuantity}`}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center space-y-2">
                  <Layers className="w-8 h-8 text-sand mx-auto" aria-hidden="true" />
                  <p className="font-serif text-xs text-ink-black/60">
                    Select a template on the left to preview items and impact on your checklist.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-3 flex items-center justify-end gap-2 border-t border-sand/40">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGuardedClose}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<Layers className="w-3.5 h-3.5" />}
            isLoading={isApplying}
            disabled={!selectedTemplate || isApplying}
            onClick={handleApply}
            data-testid="apply-template-confirm-btn"
          >
            {isApplying ? 'Applying Template...' : 'Apply Template'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
