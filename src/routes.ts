import type { SectionDef, SubpageDef } from "./types";

const sp = (id: string, label: string): SubpageDef => ({ id, label });

export const sections: SectionDef[] = [
  {
    id: "network",
    label: "Network",
    subpages: [
      sp("talent", "Talent"),
      sp("talent-bgu", "BGU alumni"),
      sp("social", "Social media"),
      sp("startups", "Startups"),
      sp("tech-networks", "Tech networks"),
    ],
  },
  {
    id: "economy",
    label: "Economy",
    subpages: [
      sp("jobs", "Jobs"),
      sp("growth", "Growth"),
      sp("investment-activity", "Investment Activity"),
    ],
  },
  {
    id: "physical",
    label: "Physical",
    subpages: [
      sp("mobility", "Mobility"),
      sp("amenities", "Amenities"),
      sp("infrastructure", "Infrastructure"),
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
