import type { MessageKey } from "./messages/en";
import type { SectionDef, SubpageDef } from "./types";

const sp = (id: string, labelKey: MessageKey): SubpageDef => ({ id, labelKey });

export const sections: SectionDef[] = [
  {
    id: "data-index",
    labelKey: "nav.dataIndex",
    subpages: [
      sp("overview", "nav.dataIndex.overview"),
      sp("methodology", "nav.dataIndex.methodology"),
    ],
  },
  {
    id: "network",
    labelKey: "nav.network",
    subpages: [
      sp("talent", "nav.network.dataSample"),
      sp("workforce", "nav.network.workforce"),
      sp("bgu", "nav.network.bgu"),
    ],
  },
  {
    id: "economy",
    labelKey: "nav.economy",
    subpages: [
      sp("ecosystem-density", "nav.economy.ecosystemDensity"),
      sp("capital-flow", "nav.economy.capitalFlow"),
      sp("innovation-bodies", "nav.economy.innovationBodies"),
      sp("synergy-index", "nav.economy.synergyIndex"),
    ],
  },
  {
    id: "urban",
    labelKey: "nav.urban",
    subpages: [
      sp("mobility", "nav.urban.mobility"),
      sp("urbanism", "nav.urban.urbanism"),
      sp("development", "nav.urban.development"),
    ],
  },
];

export function findSection(id: string) {
  return sections.find((s) => s.id === id) ?? null;
}

export function findSubpage(sectionId: string, subId: string | null) {
  const section = findSection(sectionId);
  if (!section) return null;
  if (!subId) return null;
  return section.subpages.find((p) => p.id === subId) ?? null;
}
