export type SectionId = "physical" | "network" | "economy";

export interface SubpageDef {
  id: string;
  label: string;
}

export interface SectionDef {
  id: SectionId;
  label: string;
  subpages: SubpageDef[];
}

export interface ParsedRoute {
  section: SectionId;
  subpage: string | null;
}
