import type { IntegrationDef } from "./types";

export const integrations: IntegrationDef[] = [
  // Example — uncomment and point at a built artifact under public/integrations/<your-project>/
  // { routeKey: "physical/mobility", kind: "iframe", src: "/integrations/mobility/index.html" },
];

export function getIntegration(routeKey: string): IntegrationDef | undefined {
  return integrations.find((i) => i.routeKey === routeKey);
}
