import { getIntegration } from "./integration/registry";
import type { SubpageDef } from "./types";

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

export function renderPage(
  root: HTMLElement,
  sectionId: string,
  page: SubpageDef,
): void {
  root.textContent = "";
  const routeKey = `${sectionId}/${page.id}`;
  const integration = getIntegration(routeKey);

  const canvas = el("div", "page-blank");
  const inset = el("div", "page-blank__inset");

  if (integration?.kind === "iframe") {
    inset.classList.add("page-blank__inset--media");
    const iframe = document.createElement("iframe");
    iframe.className = "integration-iframe";
    iframe.title = integration.title ?? page.label;
    iframe.src = integration.src;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    inset.appendChild(iframe);
  } else {
    inset.classList.add("page-blank__inset--placeholder");
    inset.appendChild(
      el("p", "page-blank__placeholder", `${page.label} Graphics Placeholder`),
    );
  }

  canvas.appendChild(inset);
  root.appendChild(canvas);
}
