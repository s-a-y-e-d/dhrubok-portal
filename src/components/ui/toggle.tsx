"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-transparent px-3 py-2 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--canvas-subtle)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-[var(--canvas-subtle)] disabled:text-[var(--ink-faint)] data-[state=on]:border-[var(--brand)] data-[state=on]:bg-[var(--brand-muted)] data-[state=on]:text-[var(--ink)] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 max-sm:min-h-11",
  {
    variants: {
      variant: {
        default: "bg-[var(--canvas)]",
        outline:
          "border-[var(--border-strong)] bg-[var(--canvas)] hover:border-[var(--ink-faint)]",
      },
      size: {
        default: "min-h-10 px-3",
        sm: "min-h-9 px-2.5 max-sm:min-h-11",
        lg: "min-h-11 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
