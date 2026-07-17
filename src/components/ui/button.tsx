import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-transparent px-4 py-2 text-sm font-medium leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-[var(--canvas-subtle)] disabled:text-[var(--ink-faint)] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px max-sm:min-h-11",
  {
    variants: {
      variant: {
        primary: "bg-[var(--brand)] text-[var(--on-brand)] hover:bg-[var(--brand-deep)] [&:not(:disabled)]:!text-[var(--on-brand)]",
        secondary: "border-[var(--border-strong)] bg-[var(--canvas)] text-[var(--ink)] hover:bg-[var(--canvas-subtle)]",
        ghost: "bg-transparent text-[var(--ink-secondary)] hover:bg-[var(--canvas-subtle)] hover:text-[var(--ink)]",
        danger: "border-[var(--danger)] bg-[var(--danger)] text-white hover:border-[var(--danger-deep)] hover:bg-[var(--danger-deep)] active:border-[#991b1b] active:bg-[#991b1b]",
        link: "min-h-0 rounded-none px-0 py-0 text-[var(--ink)] underline-offset-4 hover:underline",
      },
      size: {
        sm: "min-h-9 px-3 text-[13px] max-sm:min-h-11",
        default: "min-h-10 px-4 max-sm:min-h-11",
        icon: "size-10 min-h-10 p-0 max-sm:size-11 max-sm:min-h-11",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export function Button({
  className,
  variant = "primary",
  size = "default",
  type = "button",
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean }) {
  if (asChild) {
    return (
      <Slot
        data-slot="button"
        data-variant={variant}
        className={cn(buttonVariants({ variant, size }), className)}
        aria-busy={loading || undefined}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, size }), className)}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
