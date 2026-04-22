import { forwardRef } from 'react';
import { cn } from '@utils/helpers';

/** Marketing / page titles — Poppins, 32px+ at sm+ */
const HEADING_SCALE = {
  display:
    'font-heading text-3xl leading-tight tracking-tight text-gray-900 dark:text-slate-50 sm:text-4xl lg:text-5xl font-bold',
  h1: 'font-heading text-3xl leading-tight tracking-tight text-gray-900 dark:text-slate-50 sm:text-4xl font-bold',
  h2: 'font-heading text-2xl leading-tight tracking-tight text-gray-900 dark:text-slate-50 sm:text-3xl font-bold',
  h3: 'font-heading text-xl font-bold leading-snug tracking-tight text-gray-900 dark:text-slate-50',
  /** Inter — compact UI headings */
  h4: 'font-sans text-lg font-bold leading-snug tracking-tight text-gray-900 dark:text-slate-50',
  /** Auth & card titles — ~20–24px */
  title: 'font-heading text-xl font-bold leading-snug tracking-tight text-gray-900 dark:text-slate-50 sm:text-2xl',
};

const DEFAULT_HEADING_TAG = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  title: 'h2',
};

/**
 * @param {{ variant?: keyof typeof HEADING_SCALE; className?: string }} [options]
 */
export function headingVariants({ variant = 'h2', className } = {}) {
  return cn(HEADING_SCALE[variant] ?? HEADING_SCALE.h2, className);
}

export const Heading = forwardRef(function Heading(
  { as, variant = 'h2', className, ...props },
  ref,
) {
  const Comp = as ?? DEFAULT_HEADING_TAG[variant] ?? 'h2';
  return <Comp ref={ref} className={headingVariants({ variant, className })} {...props} />;
});

const TEXT_SIZE = {
  body: 'text-base leading-relaxed',
  small: 'text-sm leading-normal',
  caption: 'text-xs leading-normal',
};

const TEXT_TONE = {
  default: 'text-gray-700 dark:text-slate-200',
  muted: 'text-gray-500 dark:text-slate-400',
  subtle: 'text-gray-400 dark:text-slate-500',
  inverse: 'text-white',
  /** Muted on dark gradient panels */
  lead: 'text-slate-400',
  /** Secondary lines on hero */
  hero: 'text-slate-300',
  danger: 'text-red-700 dark:text-red-400',
};

/**
 * @param {{ variant?: keyof typeof TEXT_SIZE; tone?: keyof typeof TEXT_TONE; className?: string }} [options]
 */
export function textVariants({ variant = 'body', tone = 'default', className } = {}) {
  return cn(TEXT_SIZE[variant] ?? TEXT_SIZE.body, TEXT_TONE[tone] ?? TEXT_TONE.default, className);
}

export const Text = forwardRef(function Text(
  { as: Comp = 'p', variant = 'body', tone = 'default', className, ...props },
  ref,
) {
  return <Comp ref={ref} className={textVariants({ variant, tone, className })} {...props} />;
});
