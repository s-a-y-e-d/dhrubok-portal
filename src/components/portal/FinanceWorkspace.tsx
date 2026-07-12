"use client";

import { BillingSetup } from "./BillingSetup";
import { FinanceEditor as CollectionEditor } from "./FinanceEditor";

export function FinanceEditor({ locale }: { locale: "bn" | "en" }) {
  return <><BillingSetup locale={locale} /><CollectionEditor locale={locale} /></>;
}
