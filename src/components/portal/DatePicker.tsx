"use client";

import { format, parseISO } from "date-fns";
import { bn as bnLocale } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Locale = "bn" | "en";

function dateFromValue(value: string) {
  return value ? parseISO(`${value}T12:00:00`) : undefined;
}

export function DatePicker({
  value,
  onChange,
  locale,
  id,
  ariaLabel,
  required = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  id?: string;
  ariaLabel: string;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = dateFromValue(value);
  const label = selected
    ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(selected)
    : locale === "bn"
      ? "তারিখ বেছে নিন"
      : "Choose date";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="secondary"
          aria-label={ariaLabel}
          aria-required={required || undefined}
          className={cn("w-full justify-between font-normal", !selected && "text-[var(--ink-mute)]", className)}
        >
          {label}
          <CalendarDays data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
          locale={locale === "bn" ? bnLocale : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
