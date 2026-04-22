import { forwardRef } from 'react';
import { cn } from '@utils/helpers';

/** Vertical stack for one field (8px rhythm between label, control, helper). */
export function FormControl({ className, children }) {
  return <div className={cn('w-full space-y-2', className)}>{children}</div>;
}

export const FormLabel = forwardRef(function FormLabel(
  { className, children, required, ...props },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn('label', required && "after:ml-0.5 after:text-red-500 after:content-['*']", className)}
      {...props}
    >
      {children}
    </label>
  );
});

/** Validation copy; `role="alert"` for screen readers. */
export function FormError({ message, className, id }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={cn('error-text', className)}>
      {message}
    </p>
  );
}

/** Optional neutral hint below the control (hidden when error shown). */
export function FormHint({ children, className, id }) {
  if (!children) return null;
  return (
    <p id={id} className={cn('text-xs text-gray-500 dark:text-slate-500', className)}>
      {children}
    </p>
  );
}
