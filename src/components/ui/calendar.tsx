"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import type * as React from "react";
import { cn } from "@/lib/utils";

const defaultStartMonth = new Date(1900, 0);
const defaultEndMonth = new Date(2100, 11);

function Calendar({
  className,
  classNames,
  captionLayout = "dropdown",
  startMonth,
  endMonth,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      captionLayout={captionLayout}
      startMonth={startMonth ?? defaultStartMonth}
      endMonth={endMonth ?? defaultEndMonth}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex min-h-10 items-center justify-center px-10 text-sm font-semibold",
        caption_label: "rdp-caption_label flex h-9 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--canvas)] ps-3 pe-7 text-sm font-medium text-[var(--ink)]",
        dropdowns: "flex items-center justify-center gap-2",
        dropdown_root: "relative inline-flex items-center [&:has(select:focus-visible)_.rdp-caption_label]:ring-2 [&:has(select:focus-visible)_.rdp-caption_label]:ring-[var(--focus)] [&:has(select:hover)_.rdp-caption_label]:bg-[var(--canvas-soft)]",
        dropdown: "absolute inset-0 h-9 w-full cursor-pointer bg-[var(--canvas)] text-[var(--ink)] opacity-0 [color-scheme:inherit] disabled:pointer-events-none [&>option]:bg-[var(--canvas)] [&>option]:text-[var(--ink)]",
        months_dropdown: "min-w-24",
        years_dropdown: "min-w-20",
        chevron: "size-4 text-[var(--ink-mute)]",
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
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft className={cn("size-4", iconClassName)} {...iconProps} />
            );
          }

          if (orientation === "down") {
            return (
              <ChevronDown
                className={cn("pointer-events-none absolute end-2 size-4", iconClassName)}
                {...iconProps}
              />
            );
          }

          return <ChevronRight className={cn("size-4", iconClassName)} {...iconProps} />;
        },
        ...props.components,
      }}
      {...props}
    />
  );
}

export { Calendar };
