import "./executive-overview.css";
import { attachGridScale } from "./fit-grid-to-host";
import { loadQuarterAlumniCount } from "./load-cohort-alumni";
import { loadRealEstateDealsKpi } from "./real-estate-deals";
import { buildExecutiveOverviewModel } from "./static-kpi-data";
import { mountKpiCard } from "./kpi-card";
import type { KpiCardModel, KpiCategory } from "./types";

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

function mountCardsTrack(
  category: KpiCategory,
  cards: KpiCardModel[],
): HTMLElement {
  const cardsTrack = el("div", "executive-overview__cards");
  for (const card of cards) {
    cardsTrack.appendChild(mountKpiCard(card, category));
  }
  return cardsTrack;
}

function mountCategoryOpener(categoryLabel: string): HTMLElement {
  const opener = el("div", "executive-overview__row-opener");
  opener.appendChild(
    el("span", "executive-overview__row-opener-label", categoryLabel),
  );
  return opener;
}

export async function mountExecutiveOverview(root: HTMLElement): Promise<void> {
  root.replaceChildren();
  root.appendChild(el("div", "executive-overview__loading", "Loading…"));

  let alumniCount: string | null = null;
  let realEstateDeals = null;
  try {
    [alumniCount, realEstateDeals] = await Promise.all([
      loadQuarterAlumniCount(),
      loadRealEstateDealsKpi(),
    ]);
  } catch {
    alumniCount = null;
    realEstateDeals = null;
  }

  const blocks = buildExecutiveOverviewModel(alumniCount, realEstateDeals);

  const page = el("div", "executive-overview");
  const scaleHost = el("div", "executive-overview__scale-host");
  const grid = el("div", "executive-overview__rows");

  for (const block of blocks) {
    if (block.kind === "row") {
      const rowEl = el(
        "section",
        `executive-overview__row executive-overview__row--${block.category}`,
      );
      rowEl.appendChild(mountCategoryOpener(block.categoryLabel));
      rowEl.appendChild(mountCardsTrack(block.row.category, block.row.cards));
      grid.appendChild(rowEl);
      continue;
    }

    const group = el(
      "div",
      `executive-overview__category-group executive-overview__category-group--${block.category}`,
    );
    group.appendChild(mountCategoryOpener(block.categoryLabel));

    const subRows = el("div", "executive-overview__category-rows");
    for (const row of block.rows) {
      const rowEl = el(
        "section",
        `executive-overview__row executive-overview__row--${row.category}`,
      );
      rowEl.appendChild(mountCardsTrack(row.category, row.cards));
      subRows.appendChild(rowEl);
    }
    group.appendChild(subRows);
    grid.appendChild(group);
  }

  scaleHost.appendChild(grid);
  page.appendChild(scaleHost);
  root.replaceChildren(page);
  attachGridScale(scaleHost, grid, page);
}
