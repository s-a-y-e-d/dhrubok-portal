"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          error:
            "group-[.toaster]:!border-destructive/50 group-[.toaster]:!bg-destructive/10 group-[.toaster]:!text-destructive dark:group-[.toaster]:!bg-[var(--danger-muted)] dark:group-[.toaster]:!text-[var(--danger-deep)]",
          success:
            "group-[.toaster]:!border-[var(--success)]/40 group-[.toaster]:!bg-[var(--success-muted)] group-[.toaster]:!text-[var(--success-deep)]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
