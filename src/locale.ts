const STORAGE_KEY = "bsid-locale";

export type Locale = "en" | "he";

export function getLocale(): Locale {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "he" || raw === "en") return raw;
  return "en";
}

export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale === "he" ? "he" : "en";
  document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  localStorage.setItem(STORAGE_KEY, locale);
  window.dispatchEvent(new CustomEvent("bsid-locale-change", { detail: { locale } }));
}

export function initLocale(): void {
  const locale = getLocale();
  document.documentElement.lang = locale === "he" ? "he" : "en";
  document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
}

export function toggleLocale(): Locale {
  const next: Locale = getLocale() === "en" ? "he" : "en";
  applyLocale(next);
  return next;
}
