import { delegatedAnchorClick } from "./dom";
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
  const t = getTheme();
  btn.dataset.theme = t;
  btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

function applyThemeToggleUi(btn: HTMLButtonElement): void {
  syncThemeToggle(btn);
  const textSpan = btn.querySelector(".theme-toggle__text");
  if (textSpan) textSpan.textContent = getTheme() === "dark" ? "Dark" : "Light";
}

function mountThemeToggle(): HTMLButtonElement {
  const btn = el("button", "theme-toggle");
  btn.type = "button";
  btn.innerHTML = `<span class="theme-toggle__icons" aria-hidden="true"><span class="theme-toggle__glyph theme-toggle__glyph--moon">${ICON_MOON}</span><span class="theme-toggle__glyph theme-toggle__glyph--sun">${ICON_SUN}</span></span><span class="theme-toggle__text"></span>`;
  applyThemeToggleUi(btn);
  return btn;
}

export function mountApp(host: HTMLElement): void {
  host.textContent = "";

  const header = el("header", "app-header");
  const brand = el("div", "brand");
  const title = el("h1", "brand-title", "Beer Sheva Innovation District");
  const meta = el("span", "brand-meta", "Prototype mockup");
  brand.appendChild(title);
  brand.appendChild(meta);

  const primary = el("nav", "primary-nav");
  primary.setAttribute("aria-label", "Primary sections");

  for (const sec of sections) {
    const sub0 = sec.subpages[0]?.id ?? null;
    const a = el("a", "primary-nav__link", sec.label);
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

  const themeBtn = mountThemeToggle();
  themeBtn.addEventListener("click", (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    toggleTheme();
    applyThemeToggleUi(themeBtn);
  });

  const toolbar = el("div", "header-toolbar");
  toolbar.appendChild(navWrap);
  toolbar.appendChild(themeBtn);

  header.appendChild(brand);
  header.appendChild(toolbar);

  const subbar = el("nav", "subnav-bar");
  subbar.setAttribute("aria-label", "Section pages");
  subbar.addEventListener("click", (e) => {
    const t = delegatedAnchorClick(subbar, e, "a[data-sub]");
    if (!t) return;
    e.preventDefault();
    const sid = t.dataset.section as SectionId;
    const sub = t.dataset.sub ?? null;
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
        const a = el("a", "subnav-bar__link", p.label);
        a.href = formatHash({ section: section.id, subpage: p.id });
        a.dataset.section = section.id;
        a.dataset.sub = p.id;
        a.classList.toggle("is-active", Boolean(sub) && p.id === route.subpage);
        subbar.appendChild(a);
      }
    }

    stage.textContent = "";
    if (section && sub) {
      renderPage(stage, section.id, sub);
    }
  };

  sync();
  onRouteChange(sync);
}
