import { forwardRef } from 'react';
import { cn } from '@utils/helpers';

/** Maps to `.badge-*` tokens in globals.css (+ dark overrides). */
const PALETTE = {
  gray: 'badge-gray',
  blue: 'badge-blue',
  green: 'badge-green',
  amber: 'badge-amber',
  red: 'badge-red',
  purple: 'badge-purple',
  indigo: 'badge-indigo',
};

/** Semantic chips not in legacy palette (borders for emphasis). */
const SOFT = {
  violet:
    'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/30 dark:text-violet-300',
  critical:
    'border border-red-200 bg-red-100 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300',
  warning:
    'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
};

const SIZES = {
  md: '',
  sm: 'gap-0.5 px-2 py-0 text-[10px] leading-tight',
};

/**
 * @param {{ variant?: keyof typeof PALETTE | keyof typeof SOFT; size?: keyof typeof SIZES; className?: string }} [options]
 */
export function badgeVariants({ variant = 'gray', size = 'md', className } = {}) {
  const paletteClass = PALETTE[variant];
  const softClass = SOFT[variant];
  return cn(
    'badge',
    paletteClass,
    softClass,
    SIZES[size] ?? SIZES.md,
    className,
  );
}

/**
 * Pill label; uses 8px-based padding from `.badge` (see globals.css).
 * Pass `as="div"` only when required for layout; default is `span`.
 */
const Badge = forwardRef(function Badge(
  { as: Comp = 'span', variant = 'gray', size = 'md', className, ...props },
  ref,
) {
  return <Comp ref={ref} className={badgeVariants({ variant, size, className })} {...props} />;
});

export default Badge;
