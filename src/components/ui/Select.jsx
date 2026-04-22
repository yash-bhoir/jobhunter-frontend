import { forwardRef } from 'react';
import { cn } from '@utils/helpers';

/**
 * Native `<select>` styled with global `.input` / `.input-error`.
 */
export const Select = forwardRef(function Select(
  { className, error = false, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn('input', error && 'input-error', className)}
      aria-invalid={error || undefined}
      {...props}
    >
      {children}
    </select>
  );
});
