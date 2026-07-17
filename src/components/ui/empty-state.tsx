import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <section className="flex min-h-48 flex-col items-center justify-center gap-2 px-5 py-10 text-center" aria-labelledby="empty-state-title">
      <h2 id="empty-state-title" className="text-base font-semibold text-[var(--ink-mute)]">{title}</h2>
      {description ? <p className="max-w-md text-sm text-[var(--ink-mute)]">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}
