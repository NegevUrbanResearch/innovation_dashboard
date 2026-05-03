import type { MessageKey } from "../messages/en";

export type IntegrationKind = "iframe" | "script" | "none";

export interface IntegrationDef {
  routeKey: string;
  kind: Exclude<IntegrationKind, "none">;
  src: string;
  titleKey?: MessageKey;
}
