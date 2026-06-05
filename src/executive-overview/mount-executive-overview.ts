import "./executive-overview.css";
import { attachGridScale } from "./fit-grid-to-host";
import { loadQuarterAlumniCount } from "./load-cohort-alumni";
import { buildExecutiveOverviewModel } from "./static-kpi-data";
import { mountKpiCard } from "./kpi-card";

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

export async function mountExecutiveOverview(root: HTMLElement): Promise<void> {
  root.replaceChildren();
  root.appendChild(el("div", "executive-overview__loading", "Loading…"));

  let alumniCount: string | null = null;
  try {
    alumniCount = await loadQuarterAlumniCount();
  } catch {
    alumniCount = null;
  }

  const rows = buildExecutiveOverviewModel(alumniCount);

  const page = el("div", "executive-overview");
  const scaleHost = el("div", "executive-overview__scale-host");
  const grid = el("div", "executive-overview__rows");
  for (const row of rows) {
    const rowEl = el(
      "section",
      `executive-overview__row executive-overview__row--${row.category}`,
    );

    const opener = el("div", "executive-overview__row-opener");
    opener.appendChild(
      el("span", "executive-overview__row-opener-label", row.categoryLabel),
    );
    rowEl.appendChild(opener);

    const cardsTrack = el("div", "executive-overview__cards");
    for (const card of row.cards) {
      cardsTrack.appendChild(mountKpiCard(card, row.category));
    }
    rowEl.appendChild(cardsTrack);
    grid.appendChild(rowEl);
  }

  scaleHost.appendChild(grid);
  page.appendChild(scaleHost);
  root.replaceChildren(page);
  attachGridScale(scaleHost, grid);
}
