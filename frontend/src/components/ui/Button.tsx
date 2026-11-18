import React, { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'forest'
  | 'sunshine'
  | 'outline'
  | 'stamp'
  | 'ghost'
  | 'terracottaDark'

export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-terracotta text-warm-white hover:bg-terracotta-dark shadow-sm border border-transparent active:translate-y-px',
  terracottaDark:
    'bg-terracotta-dark text-warm-white hover:opacity-95 shadow-sm border border-transparent active:translate-y-px',
  secondary:
    'bg-warm-white text-ink-black border border-sand/40 hover:bg-sand/15 shadow-sm active:translate-y-px',
  forest:
    'bg-forest-green text-warm-white hover:opacity-90 shadow-sm border border-transparent active:translate-y-px',
  sunshine:
    'bg-sunshine-yellow text-ink-black hover:brightness-95 shadow-sm border border-transparent active:translate-y-px font-semibold',
  outline:
    'bg-transparent text-ink-black border-2 border-ink-black hover:bg-ink-black hover:text-warm-white active:translate-y-px',
  stamp:
    'bg-warm-white text-ink-black border-2 border-ink-black shadow-stamp rounded-scrapbook hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:translate-x-1 active:translate-y-1 font-semibold uppercase tracking-wider',
  ghost:
    'bg-transparent text-ink-black border border-transparent hover:bg-sand/20 active:translate-y-px',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-card gap-1.5 min-h-[32px]',
  md: 'text-sm px-4 py-2.5 rounded-card gap-2 min-h-[40px]',
  lg: 'text-base px-6 py-3.5 rounded-card gap-2.5 min-h-[48px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-sans font-medium transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
    const variantClass = variantStyles[variant] || variantStyles.primary
    const sizeClass = sizeStyles[size] || sizeStyles.md
    const widthClass = fullWidth ? 'w-full' : ''

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClass} ${sizeClass} ${widthClass} ${className}`.trim()}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
