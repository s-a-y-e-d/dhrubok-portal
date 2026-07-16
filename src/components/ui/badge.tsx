import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-7 items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium leading-4 tracking-[0.01em]",
  {
    variants: {
      variant: {
        neutral:
          "border-[var(--border-strong)] bg-[var(--canvas-subtle)] text-[var(--ink-secondary)]",
        success:
          "border-[color-mix(in_srgb,var(--success)_28%,transparent)] bg-[var(--success-muted)] text-[var(--success-deep)] before:size-1.5 before:shrink-0 before:rounded-full before:bg-[var(--success)]",
        warning:
          "border-[color-mix(in_srgb,var(--warning)_28%,transparent)] bg-[var(--warning-muted)] text-[var(--warning-deep)] before:size-1.5 before:shrink-0 before:rounded-full before:bg-[var(--warning)]",
        danger:
          "border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[var(--danger-muted)] text-[var(--danger-deep)] before:size-1.5 before:shrink-0 before:rounded-full before:bg-[var(--danger)]",
        info: "border-[color-mix(in_srgb,var(--info)_28%,transparent)] bg-[var(--info-muted)] text-[var(--info-deep)] before:size-1.5 before:shrink-0 before:rounded-full before:bg-[var(--info)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
