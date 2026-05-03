import type { Locale } from "./locale";
import { getLocale } from "./locale";
import { en, type MessageKey } from "./messages/en";
import { he } from "./messages/he";

type Catalog = Record<MessageKey, string>;

const catalogs: Record<Locale, Catalog> = {
  en: en as Catalog,
  he: he as Catalog,
};

export type { MessageKey };

export function t(key: MessageKey): string {
  const loc = getLocale();
  return catalogs[loc][key] ?? catalogs.en[key];
}

export function formatLocaleInt(n: number): string {
  return Math.round(n).toLocaleString(getLocale() === "he" ? "he-IL" : "en-US");
}

export function syncDocumentMeta(): void {
  document.title = t("meta.title");
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", t("meta.description"));
}
