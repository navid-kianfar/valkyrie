import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary border-primary/25',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-card text-muted-foreground shadow-sm',
        success: 'border-transparent bg-success/10 text-success border-success/30',
        warning: 'border-transparent bg-warning/10 text-warning border-warning/30',
        destructive: 'border-transparent bg-destructive/10 text-destructive border-destructive/30',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
