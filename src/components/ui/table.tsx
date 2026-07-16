import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <div className="w-full overflow-x-auto"><table className={cn("w-full border-collapse text-sm", className)} {...props} /></div>;
}
export function TableHeader(props: React.ComponentProps<"thead">) { return <thead {...props} />; }
export function TableBody(props: React.ComponentProps<"tbody">) { return <tbody {...props} />; }
export function TableRow({ className, ...props }: React.ComponentProps<"tr">) { return <tr className={cn("border-b border-[var(--border)] hover:bg-[var(--canvas-soft)]", className)} {...props} />; }
export function TableHead({ className, ...props }: React.ComponentProps<"th">) { return <th className={cn("h-11 px-3 text-start text-xs font-medium text-[var(--ink-mute)]", className)} {...props} />; }
export function TableCell({ className, ...props }: React.ComponentProps<"td">) { return <td className={cn("px-3 py-3 align-middle text-[var(--ink)]", className)} {...props} />; }
