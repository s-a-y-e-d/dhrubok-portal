"use client";

import { OwnerSettingsEditor as SettingsEditor } from "./OwnerEditors";
import { CoachingSettingsInitializer, OwnerAccountAdministration } from "./OwnerAdministration";

export function OwnerSettingsEditor({ locale }: { locale: "bn" | "en" }) {
  return <><CoachingSettingsInitializer locale={locale} /><SettingsEditor locale={locale} /><OwnerAccountAdministration locale={locale} /></>;
}
