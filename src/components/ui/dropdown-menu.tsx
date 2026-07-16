"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Content sideOffset={sideOffset} className={cn("z-50 min-w-44 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] p-1 text-[var(--ink)] shadow-[var(--shadow-2)]", className)} {...props} /></DropdownMenuPrimitive.Portal>;
}

export function DropdownMenuItem({ className, inset, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
  return <DropdownMenuPrimitive.Item className={cn("relative flex min-h-10 cursor-default select-none items-center gap-2 rounded-[var(--radius-xs)] px-2 py-2 text-sm outline-none focus:bg-[var(--canvas-subtle)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 max-sm:min-h-11", inset && "ps-8", className)} {...props} />;
}

export function DropdownMenuCheckboxItem({ className, children, checked, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return <DropdownMenuPrimitive.CheckboxItem checked={checked} className={cn("relative flex min-h-10 cursor-default select-none items-center rounded-[var(--radius-xs)] py-2 ps-8 pe-2 text-sm outline-none focus:bg-[var(--canvas-subtle)] max-sm:min-h-11", className)} {...props}><span className="absolute start-2"><DropdownMenuPrimitive.ItemIndicator><Check className="size-4" /></DropdownMenuPrimitive.ItemIndicator></span>{children}</DropdownMenuPrimitive.CheckboxItem>;
}

export function DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return <DropdownMenuPrimitive.Label className={cn("px-2 py-1.5 text-xs font-medium text-[var(--ink-mute)]", inset && "ps-8", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-[var(--border)]", className)} {...props} />;
}

export function DropdownMenuSubTrigger({ className, children, inset, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }) {
  return <DropdownMenuPrimitive.SubTrigger className={cn("flex min-h-10 items-center gap-2 rounded-[var(--radius-xs)] px-2 py-2 text-sm outline-none focus:bg-[var(--canvas-subtle)]", inset && "ps-8", className)} {...props}>{children}<ChevronRight className="ms-auto size-4" /></DropdownMenuPrimitive.SubTrigger>;
}
