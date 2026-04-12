import { initTheme } from "./theme";
import "./styles.css";
import { mountApp } from "./shell";

initTheme();

async function markBraveUiIfNeeded(): Promise<void> {
  try {
    const nav = navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } };
    if (nav.brave?.isBrave && (await nav.brave.isBrave())) {
      document.documentElement.dataset.braveUi = "1";
      return;
    }
  } catch {
    /* navigator.brave blocked or unavailable */
  }
  if (/\bBrave\/\d/i.test(navigator.userAgent)) {
    document.documentElement.dataset.braveUi = "1";
  }
}

void markBraveUiIfNeeded().finally(() => {
  const root = document.querySelector<HTMLElement>("#app");
  if (root) mountApp(root);
});
