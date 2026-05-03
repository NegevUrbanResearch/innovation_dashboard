import type { IntegrationDef } from "./types";

export const integrations: IntegrationDef[] = [
  {
    routeKey: "physical/mobility",
    kind: "iframe",
    src: "https://negevurbanresearch.github.io/mobility-dashboard/",
    titleKey: "iframe.mobilityTitle",
  },
  {
    routeKey: "physical/amenities",
    kind: "iframe",
    src: "https://negevurbanresearch.github.io/urban95/",
    titleKey: "iframe.amenitiesTitle",
  },
];

export function getIntegration(routeKey: string): IntegrationDef | undefined {
  return integrations.find((i) => i.routeKey === routeKey);
}
