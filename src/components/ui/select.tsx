"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger data-slot="select-trigger" className={cn("flex min-h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--canvas)] px-3 py-2 text-sm leading-5 text-[var(--ink)] transition-colors duration-150 hover:border-[var(--ink-faint)] focus-visible:border-[var(--focus)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-[var(--canvas-subtle)] disabled:text-[var(--ink-faint)] data-[placeholder]:text-[var(--ink-faint)] max-sm:min-h-11 [&>span]:truncate", className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild><ChevronDown className="size-4 shrink-0 text-[var(--ink-mute)]" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position={position} className={cn("relative z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] text-[var(--ink)] shadow-[var(--shadow-2)]", position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1", className)} {...props}>
        <SelectPrimitive.ScrollUpButton className="flex h-8 items-center justify-center"><ChevronUp className="size-4" /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className={cn("p-1", position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]")}>
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-8 items-center justify-center"><ChevronDown className="size-4" /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn("px-2 py-1.5 text-xs font-medium text-[var(--ink-mute)]", className)} {...props} />;
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item className={cn("relative flex min-h-10 w-full cursor-default select-none items-center rounded-[var(--radius-xs)] py-2 ps-8 pe-3 text-sm outline-none focus:bg-[var(--canvas-subtle)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 max-sm:min-h-11", className)} {...props}>
      <span className="absolute start-2 grid size-4 place-items-center"><SelectPrimitive.ItemIndicator><Check className="size-4" /></SelectPrimitive.ItemIndicator></span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-[var(--border)]", className)} {...props} />;
}
