import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex min-h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--canvas)] px-3 py-2 text-sm leading-5 text-[var(--ink)] shadow-none transition-colors duration-150 placeholder:text-[var(--ink-faint)] hover:border-[var(--ink-faint)] focus-visible:border-[var(--focus)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-[var(--canvas-subtle)] disabled:text-[var(--ink-faint)] read-only:bg-[var(--canvas-soft)] aria-invalid:border-[var(--danger)] aria-invalid:ring-0 max-sm:min-h-11",
        className,
      )}
      {...props}
    />
  );
}
