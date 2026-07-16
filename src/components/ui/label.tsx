"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("flex min-h-5 items-center gap-2 text-sm font-medium leading-5 text-[var(--ink-secondary)] peer-disabled:cursor-not-allowed peer-disabled:opacity-60", className)}
      {...props}
    />
  );
}
