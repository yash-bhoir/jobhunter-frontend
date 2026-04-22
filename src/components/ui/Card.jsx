import { forwardRef } from 'react';
import { cn } from '@utils/helpers';

/**
 * @param {{ interactive?: boolean; className?: string }} [options]
 */
export function cardVariants({ interactive = false, className } = {}) {
  return cn(interactive ? 'card-hover' : 'card', className);
}

/** Outer surface (`.card`); pair with `CardBody` / `CardHeader` / `CardFooter`. */
export const Card = forwardRef(function Card({ interactive, className, ...props }, ref) {
  return <div ref={ref} className={cardVariants({ interactive, className })} {...props} />;
});

/** Single node: `.card` + `.card-body` — drop-in for legacy `className="card card-body"`. */
export const CardSurface = forwardRef(function CardSurface({ className, ...props }, ref) {
  return <div ref={ref} className={cn('card', 'card-body', className)} {...props} />;
});

export const CardHeader = forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn('card-header', className)} {...props} />;
});

export const CardBody = forwardRef(function CardBody({ className, ...props }, ref) {
  return <div ref={ref} className={cn('card-body', className)} {...props} />;
});

export const CardFooter = forwardRef(function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cn('card-footer', className)} {...props} />;
});
