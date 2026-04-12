const STORAGE_KEY = "bsid-theme";

export type Theme = "light" | "dark";

export function getTheme(): Theme {
  const d = document.documentElement.dataset.theme;
  if (d === "light" || d === "dark") return d;
  return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent("bsid-theme-change", { detail: { theme } }));
}

export function initTheme(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  const theme: Theme = stored === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
