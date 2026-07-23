"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.ComponentProps<"button">, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      defaultChecked = false,
      onCheckedChange,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [uncontrolledChecked, setUncontrolledChecked] =
      React.useState(defaultChecked);
    const isChecked = checked ?? uncontrolledChecked;

    const handleClick = () => {
      const nextChecked = !isChecked;
      if (checked === undefined) setUncontrolledChecked(nextChecked);
      onCheckedChange?.(nextChecked);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        data-slot="switch"
        data-state={isChecked ? "checked" : "unchecked"}
        disabled={disabled}
        className={cn(
          "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent p-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        onClick={handleClick}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none relative flex h-6 w-11 items-center rounded-full p-0.5 transition-colors duration-150",
            isChecked ? "bg-[var(--brand)]" : "bg-[var(--border-strong)]",
          )}
        >
          <span
            className={cn(
              "pointer-events-none block size-5 rounded-full bg-[var(--canvas)] shadow-[var(--shadow-1)] transition-transform duration-150",
              isChecked ? "translate-x-5" : "translate-x-0",
            )}
          />
        </span>
      </button>
    );
  },
);
Switch.displayName = "Switch";
