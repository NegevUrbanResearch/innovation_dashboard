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

function subnavAriaLabel(sectionLabel: string): string {
  return `${t("shell.ariaSubnav")}: ${sectionLabel}`;
}

function bindInternalNav(
  anchor: HTMLAnchorElement,
  getRoute: () => { section: SectionId; subpage: string | null },
): void {
  anchor.addEventListener("click", (ev) => {
    if (ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    navigate(getRoute());
  });
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

  type NavSectionRefs = {
    item: HTMLLIElement;
    link: HTMLAnchorElement;
    desktopSubnav: HTMLElement;
    desktopSubLinks: Map<string, HTMLAnchorElement>;
    mobileSubnav: HTMLElement;
    mobileSubLinks: Map<string, HTMLAnchorElement>;
  };

  const header = el("header", "app-header");
  const brand = el("div", "brand");
  const brandLogos = el("div", "brand-logos");
  const logoWrap = el("div", "brand-logo-wrap");
  const logo = document.createElement("img");
  logo.className = "brand-logo";
  logo.src = `${import.meta.env.BASE_URL}id-logo.jpeg`;
  logo.alt = t("shell.logoAlt");
  logo.width = 160;
  logo.height = 200;
  logo.decoding = "async";
  logoWrap.appendChild(logo);

  const nurLogo = document.createElement("img");
  nurLogo.className = "brand-logo-nur";
  nurLogo.src = `${import.meta.env.BASE_URL}Nur%20Logo%20white.svg`;
  nurLogo.alt = t("shell.nurLogoAlt");
  nurLogo.width = 333;
  nurLogo.height = 157;
  nurLogo.decoding = "async";

  brandLogos.appendChild(logoWrap);
  brandLogos.appendChild(nurLogo);

  const brandText = el("div", "brand-text");
  const title = el("h1", "brand-title", t("shell.brandTitle"));
  const meta = el("span", "brand-meta", t("shell.brandMeta"));
  brandText.appendChild(title);
  brandText.appendChild(meta);
  brand.appendChild(brandLogos);
  brand.appendChild(brandText);

  const routeNav = el("nav", "primary-nav route-nav");
  routeNav.setAttribute("aria-label", t("shell.ariaPrimaryNav"));

  const routeNavRail = el("div", "route-nav__rail");
  const routeNavList = el("ul", "route-nav__sections");
  const desktopPanel = el("div", "route-nav__desktop-panel");
  const mobilePanels = el("div", "route-nav__mobile-panels");
  const routeNavRefs = new Map<SectionId, NavSectionRefs>();
  let geometryFrame = 0;

  const syncNavGeometry = () => {
    geometryFrame = 0;
    const panelRect = desktopPanel.getBoundingClientRect();
    if (panelRect.width <= 0) return;

    let activeLinkCenter = panelRect.width / 2;
    let activeLinkWidth = panelRect.width / Math.max(1, sections.length);

    for (const sec of sections) {
      const refs = routeNavRefs.get(sec.id);
      if (!refs) continue;

      const linkRect = refs.link.getBoundingClientRect();
      const columnCount = refs.desktopSubLinks.size;
      refs.desktopSubnav.style.setProperty("--route-nav-desktop-columns", String(columnCount));

      if (!refs.item.classList.contains("is-active")) continue;

      activeLinkCenter = linkRect.left - panelRect.left + linkRect.width / 2;
      activeLinkWidth = linkRect.width;
    }

    desktopPanel.style.setProperty("--route-nav-active-center", `${activeLinkCenter}px`);
    desktopPanel.style.setProperty("--route-nav-active-width", `${activeLinkWidth}px`);
  };

  const scheduleNavGeometrySync = () => {
    if (geometryFrame) cancelAnimationFrame(geometryFrame);
    geometryFrame = requestAnimationFrame(syncNavGeometry);
  };

  for (const sec of sections) {
    const sub0 = sec.subpages[0]?.id ?? null;
    const item = el("li", "route-nav__section") as HTMLLIElement;
    item.dataset.section = sec.id;

    const shell = el("div", "route-nav__section-shell");

    const link = el("a", "primary-nav__link route-nav__section-link", t(sec.labelKey));
    link.href = formatHash({ section: sec.id, subpage: sub0 });
    link.dataset.section = sec.id;
    bindInternalNav(link, () => ({
      section: sec.id,
      subpage: firstSubpageId(sec.id),
    }));

    const desktopSubnav = document.createElement("nav");
    desktopSubnav.className = "route-nav__subnav route-nav__subnav--desktop";
    desktopSubnav.id = `route-nav-subnav-${sec.id}`;
    desktopSubnav.dataset.section = sec.id;
    desktopSubnav.dataset.count = String(sec.subpages.length);
    desktopSubnav.setAttribute("aria-label", subnavAriaLabel(t(sec.labelKey)));

    const mobileSubnav = document.createElement("nav");
    mobileSubnav.className = "route-nav__subnav route-nav__subnav--mobile";
    mobileSubnav.id = `route-nav-mobile-subnav-${sec.id}`;
    mobileSubnav.dataset.section = sec.id;
    mobileSubnav.dataset.count = String(sec.subpages.length);
    mobileSubnav.dataset.rows = String(Math.ceil(sec.subpages.length / 3));
    mobileSubnav.style.setProperty(
      "--route-nav-mobile-rows",
      String(Math.ceil(sec.subpages.length / 3)),
    );
    mobileSubnav.setAttribute("aria-label", subnavAriaLabel(t(sec.labelKey)));

    const desktopSubLinks = new Map<string, HTMLAnchorElement>();
    const mobileSubLinks = new Map<string, HTMLAnchorElement>();

    for (const subpage of sec.subpages) {
      const desktopSubLink = el(
        "a",
        "subnav-bar__link route-nav__subpage-link route-nav__desktop-subpage-link",
        t(subpage.labelKey),
      );
      desktopSubLink.href = formatHash({ section: sec.id, subpage: subpage.id });
      desktopSubLink.dataset.section = sec.id;
      desktopSubLink.dataset.sub = subpage.id;
      bindInternalNav(desktopSubLink, () => ({
        section: sec.id,
        subpage: subpage.id,
      }));
      desktopSubnav.appendChild(desktopSubLink);
      desktopSubLinks.set(subpage.id, desktopSubLink);

      const mobileSubLink = el(
        "a",
        "subnav-bar__link route-nav__subpage-link route-nav__mobile-subpage-link",
        t(subpage.labelKey),
      );
      mobileSubLink.href = formatHash({ section: sec.id, subpage: subpage.id });
      mobileSubLink.dataset.section = sec.id;
      mobileSubLink.dataset.sub = subpage.id;
      bindInternalNav(mobileSubLink, () => ({
        section: sec.id,
        subpage: subpage.id,
      }));
      mobileSubnav.appendChild(mobileSubLink);
      mobileSubLinks.set(subpage.id, mobileSubLink);
    }

    shell.appendChild(link);
    item.appendChild(shell);
    routeNavList.appendChild(item);
    desktopPanel.appendChild(desktopSubnav);
    mobilePanels.appendChild(mobileSubnav);
    routeNavRefs.set(sec.id, {
      item,
      link,
      desktopSubnav,
      desktopSubLinks,
      mobileSubnav,
      mobileSubLinks,
    });
  }

  routeNavRail.appendChild(routeNavList);
  routeNav.appendChild(routeNavRail);
  routeNav.appendChild(desktopPanel);
  routeNav.appendChild(mobilePanels);

  const navWrap = el("div", "primary-nav-wrap route-nav-wrap");
  navWrap.appendChild(routeNav);

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
  toolbar.appendChild(localeBtn);
  toolbar.appendChild(themeBtn);

  header.appendChild(brand);
  header.appendChild(toolbar);

  const main = el("main", "layout-main");
  const stage = el("div", "page-stage");
  main.appendChild(stage);

  host.appendChild(header);
  host.appendChild(navWrap);
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

    for (const sec of sections) {
      const refs = routeNavRefs.get(sec.id);
      if (!refs) continue;
      const isActiveSection = sec.id === route.section;
      refs.item.classList.toggle("is-active", isActiveSection);
      refs.item.dataset.active = String(isActiveSection);
      refs.link.classList.toggle("is-active", isActiveSection);
      refs.link.removeAttribute("aria-current");

      refs.desktopSubnav.classList.toggle("is-active", isActiveSection);
      refs.desktopSubnav.dataset.active = String(isActiveSection);
      refs.desktopSubnav.setAttribute("aria-hidden", String(!isActiveSection));
      refs.desktopSubnav.inert = !isActiveSection;
      refs.mobileSubnav.classList.toggle("is-active", isActiveSection);
      refs.mobileSubnav.dataset.active = String(isActiveSection);
      refs.mobileSubnav.setAttribute("aria-hidden", String(!isActiveSection));
      refs.mobileSubnav.inert = !isActiveSection;

      for (const [subpageId, subLink] of refs.desktopSubLinks) {
        const isActiveSubpage = isActiveSection && subpageId === route.subpage;
        subLink.classList.toggle("is-active", isActiveSubpage);
        subLink.tabIndex = isActiveSection ? 0 : -1;
        if (isActiveSubpage) {
          subLink.setAttribute("aria-current", "page");
        } else {
          subLink.removeAttribute("aria-current");
        }
      }

      for (const [subpageId, subLink] of refs.mobileSubLinks) {
        const isActiveSubpage = isActiveSection && subpageId === route.subpage;
        subLink.classList.toggle("is-active", isActiveSubpage);
        subLink.tabIndex = isActiveSection ? 0 : -1;
        if (isActiveSubpage) {
          subLink.setAttribute("aria-current", "page");
        } else {
          subLink.removeAttribute("aria-current");
        }
      }
    }

    stage.textContent = "";
    if (section && sub) {
      void renderPage(stage, section.id, sub);
    }

    scheduleNavGeometrySync();
  };

  const refreshI18nChrome = () => {
    title.textContent = t("shell.brandTitle");
    meta.textContent = t("shell.brandMeta");
    logo.alt = t("shell.logoAlt");
    nurLogo.alt = t("shell.nurLogoAlt");
    routeNav.setAttribute("aria-label", t("shell.ariaPrimaryNav"));
    for (const sec of sections) {
      const refs = routeNavRefs.get(sec.id);
      if (!refs) continue;
      refs.link.textContent = t(sec.labelKey);
      refs.desktopSubnav.setAttribute("aria-label", subnavAriaLabel(t(sec.labelKey)));
      refs.mobileSubnav.setAttribute("aria-label", subnavAriaLabel(t(sec.labelKey)));
      for (const subpage of sec.subpages) {
        const subLink = refs.desktopSubLinks.get(subpage.id);
        if (subLink) subLink.textContent = t(subpage.labelKey);
        const mobileSubLink = refs.mobileSubLinks.get(subpage.id);
        if (mobileSubLink) mobileSubLink.textContent = t(subpage.labelKey);
      }
    }
    applyThemeToggleUi(themeBtn);
    syncLocaleToggleUi(localeBtn);
    sync();
  };

  window.addEventListener("bsid-locale-change", () => {
    refreshI18nChrome();
  });
  window.addEventListener("resize", scheduleNavGeometrySync);

  sync();
  onRouteChange(sync);
}
