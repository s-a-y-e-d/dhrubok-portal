"use client";

import { X } from "lucide-react";
import { type ReactNode, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const MOBILE_QUERY = "(max-width: 767px)";

function subscribeToMobileQuery(onStoreChange: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

type ResponsiveDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  children: ReactNode;
  mobileEdgeToEdge?: boolean;
};

export function ResponsiveDetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  mobileEdgeToEdge = false,
}: ResponsiveDetailDrawerProps) {
  const isMobile = useSyncExternalStore(
    subscribeToMobileQuery,
    getMobileSnapshot,
    () => false,
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        shouldScaleBackground={false}
      >
        <DrawerContent
          className={cn(
            "max-h-[90dvh] border-[var(--border)] bg-[var(--canvas)] text-[var(--ink)] shadow-[var(--shadow-3)]",
            mobileEdgeToEdge &&
              "!inset-x-0 !w-screen !max-w-none rounded-t-none",
          )}
        >
          <DrawerHeader className="relative border-b border-[var(--border)] pe-16 text-start">
            <DrawerTitle className="text-xl leading-7">{title}</DrawerTitle>
            {description ? (
              <DrawerDescription className="text-[var(--ink-mute)]">
                {description}
              </DrawerDescription>
            ) : null}
            <DrawerClose asChild>
              <Button
                className="absolute end-3 top-2"
                variant="ghost"
                size="icon"
                aria-label={closeLabel}
              >
                <X aria-hidden="true" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(560px,calc(100%-24px))]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
