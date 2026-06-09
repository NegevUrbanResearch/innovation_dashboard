export type DeepDiveMotionSnapshot = {
  originRect: DOMRect;
  targetRect: DOMRect;
  originClone: HTMLElement;
  shell?: HTMLElement;
  shellParent?: Node;
  shellNextSibling?: ChildNode | null;
  dispose(): void;
};

export type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type OverlayMotionDefinition = {
  backdropOpacity: [number, number];
  shellOpacity: [number, number];
  shellTransform: [string, string];
  shellTransformOrigin: string;
};

type MotionRects = {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
};

type GhostVisibleFace = "front" | "back" | "edge";
export type MotionDirection = "open" | "close";

type SharedElementPhaseModel = {
  travelTransform: string;
  startTransform: string;
  endTransform: string;
  travelBackdropOpacity: [number, number];
  travelDuration: number;
  travelEase: string;
};

export type MotionPhaseName =
  | "open-first-frame"
  | "open-expand"
  | "open-final-frame"
  | "close-first-frame"
  | "close-contract"
  | "close-final-frame";

export type MotionPhaseKeyframes = {
  direction: MotionDirection;
  firstFrame: MotionPhaseName;
  travelPhase: MotionPhaseName;
  finalFrame: MotionPhaseName;
  travel: {
    transform: [string, string];
    duration: number;
    ease: string;
  };
  travelBackdrop: {
    opacity: [number, number];
    duration: number;
    ease: string;
  };
};

const MATERIAL_CUSTOM_PROPERTIES = [
  "--eo-canvas",
  "--eo-surface",
  "--eo-text-primary",
  "--eo-text-secondary",
  "--eo-border-default",
  "--eo-card-radius",
  "--eo-card-stroke",
  "--eo-card-shadow",
  "--eo-category-accent",
  "--eo-category-soft",
  "--eo-fold-size",
  "--eo-fold-flap-size",
  "--eo-fold-cut",
  "--eo-physical-accent",
  "--eo-physical-soft",
  "--eo-physical-outside-accent",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rectHasArea(rect: RectLike): boolean {
  return rect.width > 0 && rect.height > 0;
}

function formatNumber(value: number): string {
  return `${Math.round(value * 1000) / 1000}`;
}

function formatScale(value: number): string {
  return formatNumber(clamp(value, 0.001, 1));
}

// Kept for existing compile-time imports only. The overlay runtime uses the
// snapshot ghost API below instead of rect-only shell animation.
export function buildOverlayMotionDefinition(
  originRect: RectLike | null,
  targetRect: RectLike,
): OverlayMotionDefinition {
  if (!originRect || !rectHasArea(originRect) || !rectHasArea(targetRect)) {
    return {
      backdropOpacity: [0, 1],
      shellOpacity: [0, 1],
      shellTransform: [
        "translate3d(0, 18px, 0) scale(0.985) rotateX(-4deg)",
        "translate3d(0, 0, 0) scale(1) rotateX(0deg)",
      ],
      shellTransformOrigin: "50% 0%",
    };
  }

  const originCenterX = originRect.left + originRect.width / 2;
  const originCenterY = originRect.top + originRect.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  const scaleX = clamp(originRect.width / targetRect.width, 0.16, 1);
  const scaleY = clamp(originRect.height / targetRect.height, 0.11, 1);
  const translateX = originCenterX - targetCenterX;
  const translateY = originCenterY - targetCenterY;
  const depthBias = clamp((1 - Math.min(scaleX, scaleY)) * 14, 4, 16);
  const transformOriginX = clamp(((originCenterX - targetRect.left) / targetRect.width) * 100, 8, 92);
  const transformOriginY = clamp(((originCenterY - targetRect.top) / targetRect.height) * 100, 4, 28);

  return {
    backdropOpacity: [0, 1],
    shellOpacity: [0.44, 1],
    shellTransform: [
      `translate3d(${formatNumber(translateX)}px, ${formatNumber(translateY)}px, 0) scale(${formatNumber(scaleX)}, ${formatNumber(scaleY)}) rotateX(-${formatNumber(depthBias)}deg)`,
      "translate3d(0, 0, 0) scale(1) rotateX(0deg)",
    ],
    shellTransformOrigin: `${formatNumber(transformOriginX)}% ${formatNumber(transformOriginY)}%`,
  };
}

function toDomRect(rect: DOMRect): DOMRect {
  return new DOMRect(rect.left, rect.top, rect.width, rect.height);
}

function snapshotCenterMotion(fromRect: DOMRect, toRect: DOMRect): MotionRects {
  const fromCenterX = fromRect.left + fromRect.width / 2;
  const fromCenterY = fromRect.top + fromRect.height / 2;
  const toCenterX = toRect.left + toRect.width / 2;
  const toCenterY = toRect.top + toRect.height / 2;

  return {
    translateX: toCenterX - fromCenterX,
    translateY: toCenterY - fromCenterY,
    scaleX: toRect.width / Math.max(fromRect.width, 1),
    scaleY: toRect.height / Math.max(fromRect.height, 1),
  };
}

function formatMotionTransform(motion: MotionRects): string {
  return `translate3d(${formatNumber(motion.translateX)}px, ${formatNumber(motion.translateY)}px, 0) scale(${formatNumber(motion.scaleX)}, ${formatNumber(motion.scaleY)})`;
}

function buildSharedElementPhaseModel(
  originRect: DOMRect,
  targetRect: DOMRect,
  direction: MotionDirection,
): SharedElementPhaseModel {
  const identityTransform = "translate3d(0, 0, 0) scale(1)";
  const travelTransform = formatMotionTransform(snapshotCenterMotion(originRect, targetRect));

  return {
    travelTransform,
    startTransform: direction === "open" ? identityTransform : travelTransform,
    endTransform: direction === "open" ? travelTransform : identityTransform,
    travelBackdropOpacity: direction === "open" ? [0, 1] : [1, 0],
    travelDuration: 420,
    travelEase: direction === "open" ? "out(4)" : "inOut(3)",
  };
}

export function buildMotionPhaseKeyframes(
  originRect: DOMRect,
  targetRect: DOMRect,
  direction: MotionDirection,
): MotionPhaseKeyframes {
  const model = buildSharedElementPhaseModel(originRect, targetRect, direction);

  return {
    direction,
    firstFrame: direction === "open" ? "open-first-frame" : "close-first-frame",
    travelPhase: direction === "open" ? "open-expand" : "close-contract",
    finalFrame: direction === "open" ? "open-final-frame" : "close-final-frame",
    travel: {
      transform: [model.startTransform, model.endTransform],
      duration: model.travelDuration,
      ease: model.travelEase,
    },
    travelBackdrop: {
      opacity: model.travelBackdropOpacity,
      duration: model.travelDuration,
      ease: "out(3)",
    },
  };
}

function fixedGhostStyles(rect: DOMRect): Partial<CSSStyleDeclaration> {
  return {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    right: "auto",
    bottom: "auto",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "20",
    transformOrigin: "50% 50%",
    transform: "translate3d(0, 0, 0) scale(1)",
  };
}

function makeDisposableSnapshot(
  originRect: DOMRect,
  targetRect: DOMRect,
  originClone: HTMLElement,
  shell?: HTMLElement,
  shellParent?: Node,
  shellNextSibling?: ChildNode | null,
): DeepDiveMotionSnapshot {
  let disposed = false;

  return {
    originRect,
    targetRect,
    originClone,
    shell,
    shellParent,
    shellNextSibling,
    dispose() {
      if (disposed) return;
      disposed = true;
      originClone.remove();
    },
  };
}

function prepareGhostAccessibility(clone: HTMLElement): void {
  clone.classList.add("exec-deep-dive-motion-ghost");
  clone.setAttribute("aria-hidden", "true");
  clone.inert = true;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function copyMaterialContext(target: HTMLElement, sources: Array<HTMLElement | null | undefined>): void {
  for (const source of sources) {
    if (!source) continue;

    const sourceStyles = getComputedStyle(source);
    for (const property of MATERIAL_CUSTOM_PROPERTIES) {
      const value = sourceStyles.getPropertyValue(property).trim();
      if (value) target.style.setProperty(property, value);
    }

    if (source.dataset.category) {
      target.dataset.category = source.dataset.category;
    }
  }
}

function buildMaterialGhost(
  rect: DOMRect,
  visibleFace: GhostVisibleFace,
  materialSources: Array<HTMLElement | null | undefined>,
  shell?: HTMLElement,
  shellRect?: DOMRect,
): HTMLElement {
  const ghost = el("div", "exec-deep-dive-motion-ghost");
  prepareGhostAccessibility(ghost);
  copyMaterialContext(ghost, materialSources);
  Object.assign(ghost.style, fixedGhostStyles(rect));

  const inner = el("div", "exec-deep-dive-motion-ghost__inner");
  inner.style.transform =
    visibleFace === "back" ? "rotateY(180deg)" : visibleFace === "edge" ? "rotateY(90deg)" : "rotateY(0deg)";

  const back = el("div", "exec-deep-dive-motion-ghost__face exec-deep-dive-motion-ghost__face--back");
  if (shell) {
    const naturalShellRect = shellRect ?? rect;
    const shellScaleX = rect.width / Math.max(naturalShellRect.width, 1);
    const shellScaleY = rect.height / Math.max(naturalShellRect.height, 1);
    const backCard = el("div", "exec-deep-dive-motion-ghost__back-card");
    const shellScale = el("div", "exec-deep-dive-motion-ghost__shell-scale");
    shellScale.style.width = `${naturalShellRect.width}px`;
    shellScale.style.height = `${naturalShellRect.height}px`;
    shellScale.style.transform = `scale(${formatScale(shellScaleX)}, ${formatScale(shellScaleY)})`;
    shell.classList.add("exec-deep-dive-overlay__shell--in-motion");
    shell.style.opacity = "1";
    shell.style.transform = "translate3d(0, 0, 0) scale(1) rotateX(0deg)";
    shell.style.transformOrigin = "0 0";
    shellScale.appendChild(shell);
    backCard.appendChild(shellScale);
    back.appendChild(backCard);
  } else {
    const shellSurface = el("div", "exec-deep-dive-motion-ghost__shell-surface");
    shellSurface.appendChild(el("span", "exec-deep-dive-motion-ghost__shell-header"));
    shellSurface.appendChild(el("span", "exec-deep-dive-motion-ghost__shell-panel exec-deep-dive-motion-ghost__shell-panel--left"));
    shellSurface.appendChild(el("span", "exec-deep-dive-motion-ghost__shell-panel exec-deep-dive-motion-ghost__shell-panel--right"));
    shellSurface.appendChild(el("span", "exec-deep-dive-motion-ghost__canvas-reveal"));
    back.appendChild(shellSurface);
  }

  inner.appendChild(back);
  ghost.appendChild(inner);
  document.body.appendChild(ghost);

  return ghost;
}

function ghostPart(snapshot: DeepDiveMotionSnapshot, selector: string): HTMLElement {
  const node = snapshot.originClone.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`Missing deep-dive motion ghost part: ${selector}`);
  return node;
}

function cardSurface(card: HTMLElement): HTMLElement {
  const surface = card.querySelector<HTMLElement>(".exec-kpi-card__surface");
  if (!surface) throw new Error("Missing KPI card surface for deep-dive motion");
  return surface;
}

function computedTransform(node: HTMLElement): string {
  const transform = getComputedStyle(node).transform;
  return transform && transform !== "none" ? transform : "";
}

function appendRotateY(baseTransform: string, degrees: number): string {
  return `${baseTransform ? `${baseTransform} ` : ""}rotateY(${formatNumber(degrees)}deg)`;
}

function takeSurfaceTransition(surface: HTMLElement): string {
  const previousTransition = surface.style.transition;
  surface.style.transition = "none";
  return previousTransition;
}

async function restoreSurfaceTransition(surface: HTMLElement, previousTransition: string): Promise<void> {
  await nextAnimationFrame();
  surface.style.transition = previousTransition;
}

export async function playOriginFrontFlipOut(origin: HTMLElement): Promise<void> {
  const surface = cardSurface(origin);
  const previousTransition = takeSurfaceTransition(surface);
  const baseTransform = computedTransform(surface);
  const edgeTransform = appendRotateY(baseTransform, 90);
  try {
    await animateWaapi(surface, {
      transform: [appendRotateY(baseTransform, 0), edgeTransform],
      duration: 120,
      ease: "in(3)",
    });
    surface.style.transform = edgeTransform;
  } finally {
    await restoreSurfaceTransition(surface, previousTransition);
  }
}

export async function playOriginFrontFlipIn(origin: HTMLElement): Promise<void> {
  const surface = cardSurface(origin);
  const previousTransition = takeSurfaceTransition(surface);
  const baseTransform = "";
  try {
    surface.style.transform = appendRotateY(baseTransform, 90);
    await nextAnimationFrame();
    await animateWaapi(surface, {
      transform: [appendRotateY(baseTransform, 90), appendRotateY(baseTransform, 0)],
      duration: 120,
      ease: "out(3)",
    });
    surface.style.transform = "";
  } finally {
    await restoreSurfaceTransition(surface, previousTransition);
  }
}

export function resetOriginFlipSurface(origin: HTMLElement | null): void {
  const surface = origin?.querySelector<HTMLElement>(".exec-kpi-card__surface");
  if (!surface) return;
  surface.style.transition = "";
  surface.style.removeProperty("transform");
}

export function captureDeepDiveOpenSnapshot(
  origin: HTMLElement,
  shell: HTMLElement,
): DeepDiveMotionSnapshot {
  const originRect = toDomRect(origin.getBoundingClientRect());
  const targetRect = toDomRect(shell.getBoundingClientRect());
  const shellParent = shell.parentNode ?? undefined;
  const shellNextSibling = shell.nextSibling;
  const clone = buildMaterialGhost(originRect, "edge", [origin, shell], shell, targetRect);

  return makeDisposableSnapshot(originRect, targetRect, clone, shell, shellParent, shellNextSibling);
}

export function captureDeepDiveCloseSnapshot(
  shell: HTMLElement,
  originRect: DOMRect,
  origin?: HTMLElement | null,
): DeepDiveMotionSnapshot {
  const targetRect = toDomRect(shell.getBoundingClientRect());
  const shellParent = shell.parentNode ?? undefined;
  const shellNextSibling = shell.nextSibling;
  const clone = buildMaterialGhost(toDomRect(originRect), "back", [shell, origin], shell, targetRect);
  clone.classList.add("exec-deep-dive-motion-ghost--shell");

  return makeDisposableSnapshot(toDomRect(originRect), targetRect, clone, shell, shellParent, shellNextSibling);
}

async function animateWaapi(
  node: HTMLElement,
  params: Record<string, string[] | number[] | string | number>,
): Promise<void> {
  const { waapi } = await import("animejs/waapi");
  await waapi.animate(node, params).then(() => undefined);
}

function setMotionPhase(clone: HTMLElement, phase: MotionPhaseName): void {
  clone.dataset.motionPhase = phase;
}

async function nextAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function playDeepDiveOpenMotion(
  snapshot: DeepDiveMotionSnapshot,
  backdrop: HTMLElement,
  shell: HTMLElement,
): Promise<void> {
  const phases = buildMotionPhaseKeyframes(
    snapshot.originRect,
    snapshot.targetRect,
    "open",
  );
  const clone = snapshot.originClone;
  const inner = ghostPart(snapshot, ".exec-deep-dive-motion-ghost__inner");

  setMotionPhase(clone, phases.firstFrame);
  inner.style.transform = "rotateY(90deg)";
  shell.style.opacity = "1";
  shell.style.transform = "translate3d(0, 0, 0) scale(1) rotateX(0deg)";
  shell.style.transformOrigin = "0 0";
  backdrop.style.opacity = "0";

  await animateWaapi(inner, {
    transform: ["rotateY(90deg)", "rotateY(180deg)"],
    duration: 120,
    ease: "out(3)",
  });
  inner.style.transform = "rotateY(180deg)";

  setMotionPhase(clone, phases.travelPhase);
  await Promise.all([
    animateWaapi(clone, {
      transform: phases.travel.transform,
      opacity: [1, 1],
      duration: phases.travel.duration,
      ease: phases.travel.ease,
    }),
    animateWaapi(backdrop, {
      opacity: phases.travelBackdrop.opacity,
      duration: phases.travelBackdrop.duration,
      ease: phases.travelBackdrop.ease,
    }),
  ]);
  clone.style.transform = phases.travel.transform[1];
  backdrop.style.opacity = "1";
  inner.style.transform = "rotateY(180deg)";
  shell.style.opacity = "1";
  shell.style.transform = "translate3d(0, 0, 0) scale(1) rotateX(0deg)";
  shell.style.transformOrigin = "0 0";
  setMotionPhase(clone, phases.finalFrame);
  await nextAnimationFrame();
}

export async function playDeepDiveCloseMotion(
  snapshot: DeepDiveMotionSnapshot,
  backdrop: HTMLElement,
  _shell: HTMLElement,
): Promise<void> {
  const phases = buildMotionPhaseKeyframes(
    snapshot.originRect,
    snapshot.targetRect,
    "close",
  );
  const clone = snapshot.originClone;
  const inner = ghostPart(snapshot, ".exec-deep-dive-motion-ghost__inner");

  setMotionPhase(clone, phases.firstFrame);
  inner.style.transform = "rotateY(180deg)";
  await nextAnimationFrame();
  setMotionPhase(clone, phases.travelPhase);
  await Promise.all([
    animateWaapi(clone, {
      transform: phases.travel.transform,
      opacity: [1, 1],
      duration: phases.travel.duration,
      ease: phases.travel.ease,
    }),
    animateWaapi(backdrop, {
      opacity: phases.travelBackdrop.opacity,
      duration: phases.travelBackdrop.duration,
      ease: phases.travelBackdrop.ease,
    }),
  ]);
  clone.style.transform = phases.travel.transform[1];
  backdrop.style.opacity = "0";
  await animateWaapi(inner, {
    transform: ["rotateY(180deg)", "rotateY(90deg)"],
    duration: 120,
    ease: "in(3)",
  });
  inner.style.transform = "rotateY(90deg)";
  setMotionPhase(clone, phases.finalFrame);
  await nextAnimationFrame();
}
