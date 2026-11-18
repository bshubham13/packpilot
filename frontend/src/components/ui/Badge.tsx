import React from 'react'

export type BadgeVariant =
  | 'terracotta'
  | 'forest'
  | 'sunshine'
  | 'sand'
  | 'stamp'
  | 'outline'

export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  icon?: React.ReactNode
}

const variantStyles: Record<BadgeVariant, string> = {
  terracotta: 'bg-terracotta/15 text-terracotta border-terracotta/30',
  forest: 'bg-forest-green/15 text-forest-green border-forest-green/30',
  sunshine: 'bg-sunshine-yellow/30 text-ink-black border-sunshine-yellow/60 font-semibold',
  sand: 'bg-sand/25 text-ink-black border-sand/50',
  stamp: 'bg-warm-white text-ink-black border-ink-black shadow-[1px_1px_0_0_#24221F] font-bold uppercase tracking-wider',
  outline: 'bg-transparent text-ink-black border-sand/60',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'terracotta',
  size = 'md',
  icon,
  className = '',
  ...props
}) => {
  return (
    <span
      className={`inline-flex items-center font-sans font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim()}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}
