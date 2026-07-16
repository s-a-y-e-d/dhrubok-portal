"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({ className, children, side = "right", ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "left" | "right" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <DialogPrimitive.Content className={cn("fixed inset-y-0 z-50 flex w-[min(440px,calc(100%-24px))] flex-col gap-4 overflow-y-auto border-[var(--border)] bg-[var(--canvas)] p-6 shadow-[var(--shadow-3)] focus:outline-none", side === "right" ? "right-0 border-l" : "left-0 border-r", className)} {...props}>
        {children}
        <DialogPrimitive.Close className="absolute end-3 top-3 grid size-10 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-mute)] hover:bg-[var(--canvas-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" aria-label="Close"><X className="size-4" /></DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("grid gap-2 pe-8", className)} {...props} />; }
export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("sticky bottom-0 mt-auto flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--canvas)] pt-4 sm:flex-row sm:justify-end", className)} {...props} />; }
export function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) { return <DialogPrimitive.Title className={cn("text-xl font-semibold leading-7", className)} {...props} />; }
export function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) { return <DialogPrimitive.Description className={cn("text-sm leading-6 text-[var(--ink-mute)]", className)} {...props} />; }
