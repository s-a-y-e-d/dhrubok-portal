import "server-only";

import type { Locale } from "./config";

const dictionaries = {
  bn: () => import("@/messages/bn.json").then((module) => module.default),
  en: () => import("@/messages/en.json").then((module) => module.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["bn"]>>;

export function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
