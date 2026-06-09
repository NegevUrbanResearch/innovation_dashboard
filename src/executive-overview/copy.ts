/** v1 English-only UI strings. No i18n layer. */
export const COPY = {
  headerTitle: "Beer Sheva Innovation District Performance Metrics",
  headerLogoAlt: "Innovation District logo",
  headerNurLogoAlt: "Nur logo",
  vs: "vs.",
  footerTargetPrefix: "Target:",
  footerNextUpdatePrefix: "Next update:",
} as const;

export const CATEGORY_LABELS: Record<
  import("./types").KpiCategory,
  string
> = {
  economy: "Economy",
  network: "Network",
  physical: "Physical",
};
