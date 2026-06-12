import { renderUnavailableDeepDive } from "./rendering.ts";
import { mountAlumniDeepDive } from "./alumni/deep-dive.ts";
import { mountRealEstateDeepDive } from "./real-estate/deep-dive.ts";
import { mountCommutingDeepDive } from "./commuting/deep-dive.ts";
import type { DeepDiveController, DeepDiveRenderer, KpiCardModel, KpiDeepDiveId } from "../types.ts";

export type RegisteredDeepDiveRenderer = DeepDiveRenderer;

const DEEP_DIVE_RENDERERS: Partial<Record<KpiDeepDiveId, RegisteredDeepDiveRenderer>> = {
  "real-estate-deals": (_card, slots) => mountRealEstateDeepDive(slots.left, slots.right),
  "commuting-count": (_card, slots) => mountCommutingDeepDive(slots.left, slots.right),
  "alumni-retention": (_card, slots) => mountAlumniDeepDive(slots.left, slots.right),
};

export function getDeepDiveRenderer(id: KpiDeepDiveId): RegisteredDeepDiveRenderer | undefined {
  return DEEP_DIVE_RENDERERS[id];
}

export function renderRegisteredDeepDive(
  card: KpiCardModel,
  leftSlot: HTMLElement,
  rightSlot: HTMLElement,
): DeepDiveController | void {
  leftSlot.replaceChildren();
  rightSlot.replaceChildren();

  const deepDiveId = card.deepDive?.id;
  if (deepDiveId) {
    const renderer = getDeepDiveRenderer(deepDiveId);
    if (renderer) {
      return renderer(card, { left: leftSlot, right: rightSlot });
    }
  }

  renderUnavailableDeepDive(card, leftSlot, rightSlot);
}
