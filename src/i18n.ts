import type { Locale } from "./locale";
import { getLocale as getLocaleInner } from "./locale";
import { en, type MessageKey } from "./messages/en";
import { he } from "./messages/he";

type Catalog = Record<MessageKey, string>;

const catalogs: Record<Locale, Catalog> = {
  en: en as Catalog,
  he: he as Catalog,
};

export type { MessageKey };

export function getLocale(): Locale {
  return getLocaleInner();
}

export function t(key: MessageKey): string {
  const loc = getLocale();
  return catalogs[loc][key] ?? catalogs.en[key];
}

export function subs(template: string, replacements: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(replacements)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
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
