import type { ParsedRoute, SectionId } from "./types";
import { findSection, findSubpage, sections } from "./routes";

function defaultRoute(): ParsedRoute {
  const s = sections[0];
  const sub = s?.subpages[0]?.id ?? null;
  return { section: (s?.id ?? "physical") as SectionId, subpage: sub };
}

function normalizeSegment(s: string | undefined): string | null {
  if (!s || s === "") return null;
  const t = s.replace(/^\/+|\/+$/g, "");
  return t === "" ? null : t;
}

export function parseHash(): ParsedRoute {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
  const sectionRaw = normalizeSegment(parts[0]);
  const subRaw = normalizeSegment(parts[1]);

  if (!sectionRaw) return defaultRoute();

  const section = findSection(sectionRaw);
  if (!section) return defaultRoute();

  if (!subRaw) {
    return { section: section.id, subpage: null };
  }

  const sub = findSubpage(section.id, subRaw);
  if (!sub) {
    return { section: section.id, subpage: null };
  }

  return { section: section.id as SectionId, subpage: sub.id };
}

export function formatHash(route: ParsedRoute): string {
  if (!route.subpage) return `#/${route.section}`;
  return `#/${route.section}/${route.subpage}`;
}

export function navigate(route: ParsedRoute, replace = false) {
  const h = formatHash(route);
  const path = `${window.location.pathname}${window.location.search}${h}`;
  if (replace) {
    window.history.replaceState(null, "", path);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  if (window.location.hash === h) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = h;
}

export function onRouteChange(handler: () => void) {
  window.addEventListener("hashchange", handler);
  window.addEventListener("popstate", handler);
  return () => {
    window.removeEventListener("hashchange", handler);
    window.removeEventListener("popstate", handler);
  };
}
