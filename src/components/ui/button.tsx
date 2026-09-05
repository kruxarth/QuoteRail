import { Slot as SlotPrimitive } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-none text-sm font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]',
        secondary: 'bg-[var(--parchment-warm)] text-[var(--foreground)] hover:bg-[var(--line)]',
        outline: 'border border-[var(--line)] bg-transparent hover:bg-[var(--parchment-warm)]',
        ghost: 'hover:bg-slate-100',
        danger: 'bg-red-700 text-white hover:bg-red-800',
      },
      size: {
        default: 'h-11 px-7 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? SlotPrimitive : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
