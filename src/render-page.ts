import { getIntegration } from "./integration/registry";
import { t } from "./i18n";
import { mountLinkedInCharts } from "./linkedin-charts/route-charts";
import type { SubpageDef } from "./types";

let disposeActiveCharts: (() => void) | null = null;
let renderGeneration = 0;

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

export async function renderPage(
  root: HTMLElement,
  sectionId: string,
  page: SubpageDef,
): Promise<void> {
  const myGen = ++renderGeneration;
  disposeActiveCharts?.();
  disposeActiveCharts = null;
  root.textContent = "";
  const routeKey = `${sectionId}/${page.id}`;
  const integration = getIntegration(routeKey);

  const canvas = el("div", "page-blank");
  const inset = el("div", "page-blank__inset");

  if (integration?.kind === "iframe") {
    inset.classList.add("page-blank__inset--media");
    const iframe = document.createElement("iframe");
    iframe.className = "integration-iframe";
    iframe.title =
      integration.titleKey != null
        ? t(integration.titleKey)
        : t(page.labelKey);
    iframe.src = integration.src;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    inset.appendChild(iframe);
  } else {
    try {
      const chartDispose = await mountLinkedInCharts(inset, routeKey);
      if (myGen !== renderGeneration) return;
      if (chartDispose) {
        inset.classList.add("page-blank__inset--charts");
        disposeActiveCharts = chartDispose;
      } else {
        inset.classList.add("page-blank__inset--placeholder");
        inset.appendChild(
          el(
            "p",
            "page-blank__placeholder",
            `${t(page.labelKey)} ${t("page.graphicsPlaceholderSuffix")}`,
          ),
        );
      }
    } catch {
      if (myGen !== renderGeneration) return;
      inset.classList.add("page-blank__inset--placeholder");
      inset.appendChild(
        el(
          "p",
          "page-blank__placeholder",
          `${t(page.labelKey)} — ${t("page.chartDataError")}`,
        ),
      );
    }
  }

  if (myGen !== renderGeneration) return;
  canvas.appendChild(inset);
  root.appendChild(canvas);
}
