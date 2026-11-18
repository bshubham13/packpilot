import React, { forwardRef } from 'react'

export type CardVariant = 'scrapbook' | 'polaroid' | 'ticket' | 'flat'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: CardPadding
  hasTape?: boolean
}

const variantStyles: Record<CardVariant, string> = {
  scrapbook: 'bg-warm-white rounded-card border border-sand/40 shadow-card',
  polaroid: 'bg-warm-white rounded-scrapbook border border-sand/30 shadow-polaroid pb-6',
  ticket: 'bg-warm-white rounded-ticket border-2 border-dashed border-sand/70 shadow-scrapbook',
  flat: 'bg-warm-white rounded-card border border-sand/30',
}

const paddingStyles: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'scrapbook',
      padding = 'md',
      hasTape = false,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`relative transition-all duration-200 ${variantStyles[variant]} ${paddingStyles[padding]} ${
          hasTape ? 'scrapbook-tape' : ''
        } ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
