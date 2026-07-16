import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium leading-4",
  {
    variants: {
      variant: {
        neutral: "bg-[var(--canvas-subtle)] text-[var(--ink-secondary)]",
        success: "bg-[var(--success-muted)] text-[var(--success-deep)]",
        warning: "bg-[var(--warning-muted)] text-[var(--warning-deep)]",
        danger: "bg-[var(--danger-muted)] text-[var(--danger-deep)]",
        info: "bg-[var(--info-muted)] text-[var(--info-deep)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
