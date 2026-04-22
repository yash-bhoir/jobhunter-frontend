import { forwardRef } from 'react';
import { cn } from '@utils/helpers';

/**
 * Text field aligned with global `.input` / `.input-error` tokens (globals.css).
 * @param {object} props
 * @param {boolean} [props.error] — invalid styling + aria-invalid
 */
export const Input = forwardRef(function Input(
  { className, error = false, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn('input', error && 'input-error', className)}
      aria-invalid={error || undefined}
      {...props}
    />
  );
});

/**
 * @param {object} props
 * @param {boolean} [props.error]
 */
export const Textarea = forwardRef(function Textarea(
  { className, error = false, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn('input', error && 'input-error', className)}
      aria-invalid={error || undefined}
      {...props}
    />
  );
});
