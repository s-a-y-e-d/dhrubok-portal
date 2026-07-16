"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/lib/utils";

export function TooltipProvider({ delayDuration = 350, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return <TooltipPrimitive.Portal><TooltipPrimitive.Content sideOffset={sideOffset} className={cn("z-50 max-w-64 rounded-[var(--radius-sm)] bg-[var(--canvas-dark)] px-3 py-2 text-xs leading-5 text-[var(--on-dark)] shadow-[var(--shadow-2)]", className)} {...props} /></TooltipPrimitive.Portal>;
}
