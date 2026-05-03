import { delegatedAnchorClick } from "./dom";
import { t } from "./i18n";
import { getLocale, toggleLocale } from "./locale";
import { findSection, findSubpage, sections } from "./routes";
import { formatHash, navigate, onRouteChange, parseHash } from "./router";
import type { SectionId } from "./types";
import { getTheme, toggleTheme } from "./theme";
import { renderPage } from "./render-page";

const ICON_MOON =
  '<svg class="theme-toggle__svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const ICON_SUN =
  '<svg class="theme-toggle__svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function firstSubpageId(sectionId: SectionId): string | null {
  return findSection(sectionId)?.subpages[0]?.id ?? null;
}

function syncThemeToggle(btn: HTMLButtonElement): void {
  const theme = getTheme();
  btn.dataset.theme = theme;
  btn.setAttribute(
    "aria-label",
    theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark"),
  );
}

function applyThemeToggleUi(btn: HTMLButtonElement): void {
  syncThemeToggle(btn);
  const textSpan = btn.querySelector(".theme-toggle__text");
  if (textSpan) textSpan.textContent = getTheme() === "dark" ? t("theme.dark") : t("theme.light");
}

function mountThemeToggle(): HTMLButtonElement {
  const btn = el("button", "theme-toggle");
  btn.type = "button";
  btn.innerHTML = `<span class="theme-toggle__icons" aria-hidden="true"><span class="theme-toggle__glyph theme-toggle__glyph--moon">${ICON_MOON}</span><span class="theme-toggle__glyph theme-toggle__glyph--sun">${ICON_SUN}</span></span><span class="theme-toggle__text"></span>`;
  applyThemeToggleUi(btn);
  return btn;
}

function mountLocaleToggle(): HTMLButtonElement {
  const btn = el("button", "locale-toggle");
  btn.type = "button";
  return btn;
}

function syncLocaleToggleUi(btn: HTMLButtonElement): void {
  btn.textContent = getLocale() === "en" ? t("locale.switchToHe") : t("locale.switchToEn");
  btn.setAttribute("aria-label", t("locale.aria"));
}

export function mountApp(host: HTMLElement): void {
  host.textContent = "";

  const header = el("header", "app-header");
  const brand = el("div", "brand");
  const logoWrap = el("div", "brand-logo-wrap");
  const logo = document.createElement("img");
  logo.className = "brand-logo";
  logo.src = `${import.meta.env.BASE_URL}id-logo.jpeg`;
  logo.alt = t("shell.logoAlt");
  logo.width = 160;
  logo.height = 200;
  logo.decoding = "async";
  logoWrap.appendChild(logo);

  const brandText = el("div", "brand-text");
  const title = el("h1", "brand-title", t("shell.brandTitle"));
  const meta = el("span", "brand-meta", t("shell.brandMeta"));
  brandText.appendChild(title);
  brandText.appendChild(meta);
  brand.appendChild(logoWrap);
  brand.appendChild(brandText);

  const primary = el("nav", "primary-nav");
  primary.setAttribute("aria-label", t("shell.ariaPrimaryNav"));

  for (const sec of sections) {
    const sub0 = sec.subpages[0]?.id ?? null;
    const a = el("a", "primary-nav__link", t(sec.labelKey));
    a.href = formatHash({ section: sec.id, subpage: sub0 });
    a.dataset.section = sec.id;
    a.addEventListener("click", (ev) => {
      if (ev.button !== 0) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      const id = sec.id;
      const sub = firstSubpageId(id);
      if (sub) navigate({ section: id, subpage: sub });
    });
    primary.appendChild(a);
  }

  const navWrap = el("div", "primary-nav-wrap");
  navWrap.appendChild(primary);

  const localeBtn = mountLocaleToggle();
  syncLocaleToggleUi(localeBtn);
  localeBtn.addEventListener("click", (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    toggleLocale();
  });

  const themeBtn = mountThemeToggle();
  themeBtn.addEventListener("click", (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    toggleTheme();
    applyThemeToggleUi(themeBtn);
  });

  const toolbar = el("div", "header-toolbar");
  toolbar.appendChild(navWrap);
  toolbar.appendChild(localeBtn);
  toolbar.appendChild(themeBtn);

  header.appendChild(brand);
  header.appendChild(toolbar);

  const subbar = el("nav", "subnav-bar");
  subbar.setAttribute("aria-label", t("shell.ariaSubnav"));
  subbar.addEventListener("click", (e) => {
    const anchor = delegatedAnchorClick(subbar, e, "a[data-sub]");
    if (!anchor) return;
    e.preventDefault();
    const sid = anchor.dataset.section as SectionId;
    const sub = anchor.dataset.sub ?? null;
    navigate({ section: sid, subpage: sub });
  });

  const main = el("main", "layout-main");
  const stage = el("div", "page-stage");
  main.appendChild(stage);

  host.appendChild(header);
  host.appendChild(subbar);
  host.appendChild(main);

  const sync = () => {
    const route = parseHash();
    const section = findSection(route.section);
    if (section && route.subpage === null && section.subpages.length > 0) {
      navigate({ section: section.id, subpage: section.subpages[0].id }, true);
      return;
    }

    const sub =
      section && route.subpage ? findSubpage(section.id, route.subpage) : null;

    for (const link of primary.querySelectorAll<HTMLAnchorElement>("a[data-section]")) {
      link.classList.toggle("is-active", link.dataset.section === route.section);
    }

    subbar.textContent = "";
    if (section) {
      for (const p of section.subpages) {
        const a = el("a", "subnav-bar__link", t(p.labelKey));
        a.href = formatHash({ section: section.id, subpage: p.id });
        a.dataset.section = section.id;
        a.dataset.sub = p.id;
        a.classList.toggle("is-active", Boolean(sub) && p.id === route.subpage);
        subbar.appendChild(a);
      }
    }

    stage.textContent = "";
    if (section && sub) {
      void renderPage(stage, section.id, sub);
    }
  };

  const refreshI18nChrome = () => {
    title.textContent = t("shell.brandTitle");
    meta.textContent = t("shell.brandMeta");
    logo.alt = t("shell.logoAlt");
    primary.setAttribute("aria-label", t("shell.ariaPrimaryNav"));
    subbar.setAttribute("aria-label", t("shell.ariaSubnav"));
    for (const sec of sections) {
      const link = primary.querySelector<HTMLAnchorElement>(`a[data-section="${sec.id}"]`);
      if (link) link.textContent = t(sec.labelKey);
    }
    applyThemeToggleUi(themeBtn);
    syncLocaleToggleUi(localeBtn);
    sync();
  };

  window.addEventListener("bsid-locale-change", () => {
    refreshI18nChrome();
  });

  sync();
  onRouteChange(sync);
}
