/** v1: app is light-mode only. Dark toggle removed. */
export function applyLightTheme(): void {
  document.documentElement.dataset.theme = "light";
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  try {
    localStorage.removeItem("bsid-theme");
    localStorage.removeItem("bsid-locale");
  } catch {
    /* private browsing */
  }
}
