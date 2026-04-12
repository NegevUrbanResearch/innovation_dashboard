import type { IntegrationDef } from "./types";

export const integrations: IntegrationDef[] = [
  {
    routeKey: "physical/mobility",
    kind: "iframe",
    src: "https://negevurbanresearch.github.io/mobility-dashboard/",
    title: "Mobility dashboard",
  },
  {
    routeKey: "physical/amenities",
    kind: "iframe",
    src: "https://negevurbanresearch.github.io/urban95/",
    title: "Urban95 amenities",
  },
];

export function getIntegration(routeKey: string): IntegrationDef | undefined {
  return integrations.find((i) => i.routeKey === routeKey);
}
