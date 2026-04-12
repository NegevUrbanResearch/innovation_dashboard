export type IntegrationKind = "iframe" | "script" | "none";

export interface IntegrationDef {
  routeKey: string;
  kind: Exclude<IntegrationKind, "none">;
  src: string;
  title?: string;
}
