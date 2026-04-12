import type { SectionDef, SubpageDef } from "./types";

const sp = (id: string, label: string): SubpageDef => ({ id, label });

export const sections: SectionDef[] = [
  {
    id: "physical",
    label: "Physical",
    subpages: [
      sp("mobility", "Mobility"),
      sp("amenities", "Amenities"),
      sp("infrastructure", "Infrastructure"),
    ],
  },
  {
    id: "network",
    label: "Network",
    subpages: [
      sp("social", "Social media"),
      sp("startups", "Startups"),
      sp("tech-networks", "Tech networks"),
      sp("talent", "Talent"),
    ],
  },
  {
    id: "economy",
    label: "Economy",
    subpages: [
      sp("growth", "Growth"),
      sp("fundraising", "Fundraising"),
      sp("jobs", "Jobs"),
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
