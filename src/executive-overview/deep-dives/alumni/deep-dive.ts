import { mergeBguRowsAcrossResidencePanels } from "../../../alumni-charts/aggregates/bgu-treemap-model.ts";
import { mountBguCohortPartition } from "../../../alumni-charts/bgu-cohort-partition.ts";
import { mountBguEmployerTreemap } from "../../../alumni-charts/bgu-employer-treemap.ts";
import { mountChartPanel } from "../../../alumni-charts/chart-panel.ts";
import type { BguTreemapRow, CohortVennModel } from "../../../alumni-charts/csv.ts";
import { formatLocaleInt, subs, t } from "../../../i18n.ts";
import type { DeepDiveController } from "../../types.ts";
import type { AlumniDeepDiveData } from "./data.ts";
import { loadAlumniDeepDiveData } from "./data.ts";
import { mountGraduationFieldChart } from "./graduation-chart.ts";
import { mountAlumniFeederMap, type AlumniFeederMapController } from "./map.ts";

type AlumniCohort = "all-bgu" | "bs-workers";

const COHORT_VALUES: readonly AlumniCohort[] = ["all-bgu", "bs-workers"];

const ALUMNI_WORKING_SEGMENTS = ["bgu_and_worker_not_resident", "bgu_resident_and_worker"] as const;

export function alumniWorkingInBsCount(venn: CohortVennModel): number {
  return venn.partitions
    .filter((p) => (ALUMNI_WORKING_SEGMENTS as readonly string[]).includes(p.segment))
    .reduce((sum, p) => sum + p.count, 0);
}

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

function cohortLabel(cohort: AlumniCohort): string {
  if (cohort === "all-bgu") return t("alumniDeepDive.cohortAllBgu");
  return t("alumniDeepDive.cohortBsWorkers");
}

function rowsForCohort(data: AlumniDeepDiveData, cohort: AlumniCohort): BguTreemapRow[] {
  if (cohort === "bs-workers") return data.treemapBsWorkers;
  return mergeBguRowsAcrossResidencePanels(data.treemapAllBgu);
}

function sampleForTab(tabId: string, data: AlumniDeepDiveData): string {
  switch (tabId) {
    case "cohort-venn":
      return subs(t("chart.sampleBguCohortOverlap"), {
        n: formatLocaleInt(data.cohortVenn.totals.totalProfiles),
      });
    case "employers":
      return subs(t("chart.sampleBguEmployerTreemap"), {
        n: formatLocaleInt(rowsForCohort(data, "all-bgu").length),
      });
    case "graduation": {
      const n =
        data.graduationMeta?.nKnown ??
        data.graduationFieldYear.reduce((sum, row) => sum + row.count, 0);
      return subs(t("alumniDeepDive.sampleGraduationFields"), {
        n: formatLocaleInt(n),
      });
    }
    default:
      return "";
  }
}

function createCohortToggle(
  getCohort: () => AlumniCohort,
  onSelect: (value: AlumniCohort) => void,
): { root: HTMLDivElement; sync: () => void } {
  const root = el("div", "exec-alumni__cohort-toggle");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Alumni cohort");

  const buttons = new Map<AlumniCohort, HTMLButtonElement>();

  const sync = () => {
    const current = getCohort();
    for (const [value, button] of buttons) {
      const selected = value === current;
      button.dataset.selected = selected ? "true" : "false";
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  };

  for (const value of COHORT_VALUES) {
    const button = el("button", "exec-alumni__cohort-segment", cohortLabel(value));
    button.type = "button";
    button.addEventListener("click", () => onSelect(value));
    buttons.set(value, button);
    root.appendChild(button);
  }

  sync();
  return { root, sync };
}

function mountEmployersTab(host: HTMLDivElement, data: AlumniDeepDiveData): () => void {
  let cohort: AlumniCohort = "all-bgu";
  let treemapDisposer: (() => void) | null = null;

  const treemapHost = el("div", "exec-alumni-treemap__host");

  const remountTreemap = () => {
    treemapDisposer?.();
    treemapDisposer = mountBguEmployerTreemap(treemapHost, rowsForCohort(data, cohort));
  };

  const { root: toggleRoot, sync } = createCohortToggle(
    () => cohort,
    (next) => {
      cohort = next;
      sync();
      remountTreemap();
    },
  );

  host.append(toggleRoot, treemapHost);
  remountTreemap();

  return () => {
    treemapDisposer?.();
    treemapDisposer = null;
  };
}

function mountGraduationTab(host: HTMLDivElement, data: AlumniDeepDiveData): () => void {
  const canvas = document.createElement("canvas");
  canvas.className = "chart-panel__canvas";
  host.appendChild(canvas);
  const { destroy } = mountGraduationFieldChart(canvas, data.graduationFieldYear);
  return destroy;
}

function renderLoadingState(leftSlot: HTMLElement, rightSlot: HTMLElement): void {
  leftSlot.replaceChildren(el("div", "exec-deep-dive__loading-state", "Loading alumni analysis..."));
  rightSlot.replaceChildren(el("div", "exec-deep-dive__loading-state", "Preparing feeder map..."));
}

function renderUnavailableState(leftSlot: HTMLElement, rightSlot: HTMLElement): void {
  const unavailable = el("section", "exec-alumni-unavailable");
  unavailable.appendChild(el("h3", "exec-alumni-unavailable__title", "Alumni retention deep dive unavailable"));
  unavailable.appendChild(
    el(
      "p",
      "exec-alumni-unavailable__copy",
      "The alumni aggregate files could not be loaded. The shell stays available, but this evidence module needs reachable cohort, treemap, and graduation data from public/alumni/.",
    ),
  );
  leftSlot.replaceChildren(unavailable);
  rightSlot.replaceChildren(el("div", "exec-deep-dive__loading-state", "Map unavailable"));
}

export function mountAlumniDeepDive(leftSlot: HTMLElement, rightSlot: HTMLElement): DeepDiveController {
  let destroyed = false;
  let mapController: AlumniFeederMapController | null = null;
  let chartPanelDisposer: (() => void) | null = null;
  let leftHost: HTMLDivElement | null = null;
  let rightHost: HTMLDivElement | null = null;

  renderLoadingState(leftSlot, rightSlot);

  void (async () => {
    const loaded = await loadAlumniDeepDiveData();
    if (destroyed) return;
    if (!loaded) {
      renderUnavailableState(leftSlot, rightSlot);
      return;
    }

    const shell = el("section", "exec-alumni-deep-dive");
    leftHost = el("div", "exec-alumni-deep-dive__left-host");
    shell.appendChild(leftHost);
    leftSlot.replaceChildren(shell);

    rightHost = el("div", "exec-alumni-map");
    rightSlot.replaceChildren(rightHost);

    const kpiCount = alumniWorkingInBsCount(loaded.cohortVenn);

    chartPanelDisposer = mountChartPanel(leftHost, {
      title: "Alumni Retention",
      leadNote: `Headline KPI counts BGU alumni working in Beer Sheva (${formatLocaleInt(kpiCount)} in current extract).`,
      sampleNote: (tabId) => sampleForTab(tabId, loaded),
      tabs: [
        {
          id: "cohort-venn",
          label: t("chart.tabBguCohortOverlap"),
          kind: "custom",
          mountCustom: (host) => {
            const vennHost = el("div", "exec-alumni-venn__host");
            host.appendChild(vennHost);
            return mountBguCohortPartition(vennHost, loaded.cohortVenn);
          },
        },
        {
          id: "employers",
          label: t("alumniDeepDive.tabEmployers"),
          kind: "custom",
          mountCustom: (host) => mountEmployersTab(host, loaded),
        },
        {
          id: "graduation",
          label: t("alumniDeepDive.tabGraduationFields"),
          kind: "custom",
          mountCustom: (host) => mountGraduationTab(host, loaded),
        },
      ],
    });

    if (rightHost) {
      mapController = mountAlumniFeederMap(rightHost, {
        feederCities: loaded.feederCities,
        cityCentroids: loaded.cityCentroids,
      });
    }
  })();

  return {
    destroy() {
      destroyed = true;
      chartPanelDisposer?.();
      chartPanelDisposer = null;
      mapController?.destroy();
      mapController = null;
      leftHost = null;
      rightHost = null;
    },
    onVisible() {
      mapController?.resize();
    },
  };
}
