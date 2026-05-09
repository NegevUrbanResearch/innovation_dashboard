import type { MessageKey } from "./messages/en";

export type SectionId = "data-index" | "network" | "economy" | "urban";

export interface SubpageDef {
  id: string;
  labelKey: MessageKey;
}

export interface SectionDef {
  id: SectionId;
  labelKey: MessageKey;
  subpages: SubpageDef[];
}

export interface ParsedRoute {
  section: SectionId;
  subpage: string | null;
}
