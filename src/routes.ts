import type { MessageKey } from "./messages/en";
import type { SectionDef, SubpageDef } from "./types";

const sp = (id: string, labelKey: MessageKey): SubpageDef => ({ id, labelKey });

export const sections: SectionDef[] = [
  {
    id: "network",
    labelKey: "nav.network",
    subpages: [
      sp("talent", "nav.network.talent"),
      sp("talent-bgu", "nav.network.talent-bgu"),
      sp("social", "nav.network.social"),
      sp("startups", "nav.network.startups"),
      sp("tech-networks", "nav.network.tech-networks"),
    ],
  },
  {
    id: "economy",
    labelKey: "nav.economy",
    subpages: [
      sp("jobs", "nav.economy.jobs"),
      sp("growth", "nav.economy.growth"),
      sp("investment-activity", "nav.economy.investment-activity"),
    ],
  },
  {
    id: "physical",
    labelKey: "nav.physical",
    subpages: [
      sp("mobility", "nav.physical.mobility"),
      sp("amenities", "nav.physical.amenities"),
      sp("infrastructure", "nav.physical.infrastructure"),
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
