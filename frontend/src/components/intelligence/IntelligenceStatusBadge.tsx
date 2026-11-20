import React from 'react'
import {
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Info,
} from 'lucide-react'
import type { IntelligenceStatus } from '../../utils/intelligence'

export interface IntelligenceStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: IntelligenceStatus
  label?: string
  size?: 'sm' | 'md'
  showIcon?: boolean
}

interface StatusVisualConfig {
  defaultLabel: string
  containerClasses: string
  icon: React.ReactNode
}

const STATUS_CONFIGS: Record<IntelligenceStatus, StatusVisualConfig> = {
  resolving: {
    defaultLabel: 'Updating...',
    containerClasses: 'bg-sand/20 text-ink-black border-sand/40',
    icon: <Loader2 className="w-3 h-3 animate-spin text-terracotta" />,
  },
  available: {
    defaultLabel: 'Available',
    containerClasses: 'bg-forest-green/15 text-forest-green border-forest-green/30 font-medium',
    icon: <CheckCircle2 className="w-3 h-3 text-forest-green" />,
  },
  cached: {
    defaultLabel: 'Cached',
    containerClasses: 'bg-sand/25 text-ink-black border-sand/50',
    icon: <Clock className="w-3 h-3 text-ink-muted" />,
  },
  partial: {
    defaultLabel: 'Partial',
    containerClasses: 'bg-sunshine-yellow/30 text-ink-black border-sunshine-yellow/60 font-semibold',
    icon: <Clock className="w-3 h-3 text-ink-black" />,
  },
  outside_horizon: {
    defaultLabel: 'Outside Horizon',
    containerClasses: 'bg-sand/20 text-ink-muted border-sand/40',
    icon: <Clock className="w-3 h-3 text-ink-muted" />,
  },
  offline_fallback: {
    defaultLabel: 'Offline Baseline',
    containerClasses: 'bg-sand/15 text-ink-muted border-sand/30',
    icon: <Info className="w-3 h-3 text-ink-muted" />,
  },
  failed: {
    defaultLabel: 'Unavailable',
    containerClasses: 'bg-terracotta/15 text-terracotta border-terracotta/30 font-medium',
    icon: <AlertCircle className="w-3 h-3 text-terracotta" />,
  },
  idle: {
    defaultLabel: 'Pending',
    containerClasses: 'bg-transparent text-ink-muted border-sand/40',
    icon: null,
  },
}

const SIZE_CLASSES = {
  sm: 'text-[11px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
}

/**
 * Reusable Travel Intelligence status badge adhering to PackPilot's
 * Travel Scrapbook + Adventure Editorial design tokens.
 */
export const IntelligenceStatusBadge: React.FC<IntelligenceStatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  showIcon = true,
  className = '',
  ...props
}) => {
  const config = STATUS_CONFIGS[status] ?? STATUS_CONFIGS.idle
  const displayText = label ?? config.defaultLabel

  return (
    <span
      role="status"
      aria-label={`Intelligence status: ${displayText}`}
      className={`inline-flex items-center font-sans rounded-full border transition-colors ${config.containerClasses} ${SIZE_CLASSES[size]} ${className}`.trim()}
      {...props}
    >
      {showIcon && config.icon && <span className="shrink-0">{config.icon}</span>}
      <span className="truncate">{displayText}</span>
    </span>
  )
}
