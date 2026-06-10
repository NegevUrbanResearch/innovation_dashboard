import { renderRegisteredDeepDive } from "../deep-dives/registry.ts";
import {
  mountDeepDiveOverlayController,
  type DeepDiveOverlayController,
} from "./deep-dive-overlay-controller.ts";

export function mountKpiDeepDiveOverlay(host: HTMLElement): DeepDiveOverlayController {
  return mountDeepDiveOverlayController(host, renderRegisteredDeepDive);
}
