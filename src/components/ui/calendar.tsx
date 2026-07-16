"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Calendar({ className, classNames, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex h-10 items-center justify-center text-sm font-semibold",
        nav: "absolute inset-x-2 top-2 flex h-10 items-center justify-between",
        button_previous: "inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--ink-secondary)] hover:bg-[var(--canvas-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
        button_next: "inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--ink-secondary)] hover:bg-[var(--canvas-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "flex-1 py-1 text-center text-xs font-medium text-[var(--ink-mute)]",
        week: "mt-1 flex w-full",
        day: "flex-1 text-center",
        day_button: "inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-sm hover:bg-[var(--canvas-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] aria-selected:bg-[var(--brand)] aria-selected:text-[var(--on-brand)]",
        today: "font-semibold text-[var(--brand-deep)]",
        outside: "text-[var(--ink-faint)]",
        disabled: "text-[var(--ink-faint)] opacity-50",
        selected: "",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", iconClassName)} {...iconProps} />
          ) : (
            <ChevronRight className={cn("size-4", iconClassName)} {...iconProps} />
          ),
        ...props.components,
      }}
      {...props}
    />
  );
}

export { Calendar };
