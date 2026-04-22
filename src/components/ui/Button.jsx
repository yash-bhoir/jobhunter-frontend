import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@utils/helpers';

const baseStyles = cn(
  'inline-flex items-center justify-center font-semibold rounded-xl select-none',
  'transition-all duration-200',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0b0f19]',
  'disabled:pointer-events-none disabled:opacity-50',
  'active:scale-[0.98]',
);

const variantStyles = {
  primary: cn(
    'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-sm',
    'hover:from-blue-700 hover:to-blue-600 hover:shadow-md',
    'focus-visible:ring-blue-500',
  ),
  secondary: cn(
    'bg-white text-gray-700 border border-gray-200 shadow-sm',
    'hover:bg-gray-50 hover:border-gray-300',
    'focus-visible:ring-gray-400',
    'dark:bg-[#1a2235] dark:text-slate-300 dark:border-[#2a3a50] dark:hover:bg-[#1e2a3a]',
  ),
  danger: cn(
    'bg-red-50 text-red-700 border border-red-200',
    'hover:bg-red-100 hover:border-red-300',
    'focus-visible:ring-red-400',
  ),
  ghost: cn(
    'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    'focus-visible:ring-gray-400',
    'dark:text-slate-400 dark:hover:bg-[#1e2a3a] dark:hover:text-slate-100',
  ),
  success: cn(
    'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-sm',
    'hover:from-emerald-700 hover:to-emerald-600',
    'focus-visible:ring-emerald-500',
  ),
  /** Bordered neutral — OAuth / secondary actions */
  outline: cn(
    'bg-white text-gray-700 border border-gray-200 shadow-sm',
    'hover:bg-gray-50 hover:border-gray-300',
    'focus-visible:ring-gray-400',
    'dark:bg-[#1a2235] dark:text-slate-300 dark:border-[#2a3a50] dark:hover:bg-[#1e2a3a]',
  ),
};

const sizeStyles = {
  sm: 'gap-1.5 min-h-9 px-3 py-2 text-xs rounded-lg',
  md: 'gap-2 min-h-11 px-4 py-2 text-sm',
  lg: 'gap-2 min-h-12 px-5 py-3 text-base rounded-2xl',
  icon: 'min-h-11 min-w-11 p-0 rounded-xl',
  'icon-sm': 'min-h-9 min-w-9 p-0 rounded-lg',
};

/**
 * @param {{ variant?: keyof typeof variantStyles; size?: keyof typeof sizeStyles; loading?: boolean; className?: string }} [options]
 */
export function buttonVariants({ variant = 'primary', size = 'md', className } = {}) {
  return cn(baseStyles, variantStyles[variant], sizeStyles[size], className);
}

/**
 * Design-system button: 8px-based spacing, WCAG-friendly focus, loading state.
 * For router links, use `className={buttonVariants({ variant, size })}` on `<Link />`.
 */
const Button = forwardRef(function Button(
  {
    type = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    className,
    children,
    ...props
  },
  ref,
) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : null}
      {children}
    </button>
  );
});

export default Button;
