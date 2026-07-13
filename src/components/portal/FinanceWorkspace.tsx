"use client";

import { FinanceEditor as CollectionEditor } from "./FinanceEditor";

export function FinanceEditor({ locale }: { locale: "bn" | "en" }) {
  return <CollectionEditor locale={locale} />;
}
