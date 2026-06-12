import {
  captureDeepDiveCloseSnapshot,
  captureDeepDiveOpenSnapshot,
  playDeepDiveCloseMotion,
  playDeepDiveOpenMotion,
  playOriginFrontFlipIn,
  playOriginFrontFlipOut,
  resetOriginFlipSurface,
  type DeepDiveMotionSnapshot,
} from "./overlay-motion.ts";
import { createDeepDiveShell, loadingNode } from "./deep-dive-shell.ts";
import {
  hideBackgroundFromFocus,
  restoreBackgroundAccessibility,
  trapFocus,
  type BackgroundAccessibilityState,
} from "./deep-dive-focus.ts";
import type { DeepDiveController, KpiCardModel } from "../types.ts";

export type RenderDeepDive = (
  card: KpiCardModel,
  leftSlot: HTMLElement,
  rightSlot: HTMLElement,
) => DeepDiveController | void;

export type DeepDiveOverlayController = {
  open(card: KpiCardModel, origin: HTMLElement): void;
  close(): void;
  destroy(): void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setOriginFlipState(origin: HTMLElement | null, state: "front" | "back"): void {
  if (!origin) return;
  if (state === "back") {
    origin.dataset.flipState = "back";
    return;
  }
  delete origin.dataset.flipState;
}

export function mountDeepDiveOverlayController(
  host: HTMLElement,
  renderDeepDive: RenderDeepDive,
): DeepDiveOverlayController {
  const { overlay, backdrop, shell, title, closeButton, leftSlot, rightSlot } = createDeepDiveShell();
  host.appendChild(overlay);

  let activeOrigin: HTMLElement | null = null;
  let activeOriginRect: DOMRect | null = null;
  let activeMotionSnapshot: DeepDiveMotionSnapshot | null = null;
  let isOpen = false;
  let isDestroyed = false;
  let activeController: DeepDiveController | null = null;
  let transitionToken = 0;
  let backgroundAccessibilityStates: BackgroundAccessibilityState[] = [];

  const disposeActiveSnapshot = () => {
    const snapshot = activeMotionSnapshot;
    if (snapshot?.shell && snapshot.shellParent) {
      snapshot.shell.classList.remove("exec-deep-dive-overlay__shell--in-motion");
      if (snapshot.shellNextSibling?.parentNode === snapshot.shellParent) {
        snapshot.shellParent.insertBefore(snapshot.shell, snapshot.shellNextSibling);
      } else {
        snapshot.shellParent.appendChild(snapshot.shell);
      }
    }
    snapshot?.dispose();
    activeMotionSnapshot = null;
  };

  const restoreOriginVisibility = (origin: HTMLElement | null) => {
    if (!origin) return;
    if (origin.dataset.deepDiveOriginHidden === "true") {
      origin.style.visibility = "";
      delete origin.dataset.deepDiveOriginHidden;
    }
  };

  const resetOverlayVisuals = () => {
    backdrop.style.opacity = "";
    shell.style.opacity = "";
    shell.style.transform = "";
    shell.style.transformOrigin = "";
  };

  const hideOriginForMotion = (origin: HTMLElement) => {
    origin.dataset.deepDiveOriginHidden = "true";
    origin.style.visibility = "hidden";
  };

  const restoreMotionShell = (snapshot: DeepDiveMotionSnapshot) => {
    if (!snapshot.shell || !snapshot.shellParent) return;
    snapshot.shell.classList.remove("exec-deep-dive-overlay__shell--in-motion");
    if (snapshot.shellNextSibling?.parentNode === snapshot.shellParent) {
      snapshot.shellParent.insertBefore(snapshot.shell, snapshot.shellNextSibling);
    } else {
      snapshot.shellParent.appendChild(snapshot.shell);
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (!isOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab") return;
    trapFocus(event, shell);
  };

  function open(card: KpiCardModel, origin: HTMLElement): void {
    if (isDestroyed || !card.deepDive) return;

    const token = ++transitionToken;
    disposeActiveSnapshot();
    restoreOriginVisibility(activeOrigin);
    activeController?.destroy();
    activeController = null;

    if (backgroundAccessibilityStates.length) {
      restoreBackgroundAccessibility(backgroundAccessibilityStates);
      backgroundAccessibilityStates = [];
    }

    setOriginFlipState(activeOrigin, "front");
    activeOrigin = origin;
    const originRect = origin.getBoundingClientRect();
    activeOriginRect = new DOMRect(originRect.left, originRect.top, originRect.width, originRect.height);
    title.textContent = card.kpiName;
    shell.dataset.category = card.category;
    activeController = renderDeepDive(card, leftSlot, rightSlot) || null;

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    overlay.dataset.state = "opening";
    isOpen = true;
    backgroundAccessibilityStates = hideBackgroundFromFocus(overlay, host);

    requestAnimationFrame(() => {
      if (!isOpen || isDestroyed || token !== transitionToken) return;

      if (prefersReducedMotion()) {
        backdrop.style.opacity = "1";
        shell.style.opacity = "1";
        shell.style.transform = "translate3d(0, 0, 0) scale(1) rotateX(0deg)";
        shell.style.transformOrigin = "0 0";
        overlay.dataset.state = "open";
        activeController?.onVisible();
        return;
      }

      void (async () => {
        const snapshot = captureDeepDiveOpenSnapshot(origin, shell);
        snapshot.originClone.style.visibility = "hidden";
        activeMotionSnapshot = snapshot;

        await playOriginFrontFlipOut(origin);
        if (!isOpen || isDestroyed || token !== transitionToken) return;

        if (!isOpen || isDestroyed || token !== transitionToken) return;

        hideOriginForMotion(origin);
        snapshot.originClone.style.visibility = "";
        await playDeepDiveOpenMotion(snapshot, backdrop, shell);
        return snapshot;
      })()
        .then(() => {
          if (!isOpen || isDestroyed || token !== transitionToken) return;
          const snapshot = activeMotionSnapshot;
          if (snapshot) restoreMotionShell(snapshot);
          overlay.dataset.state = "open";
          resetOverlayVisuals();
          activeController?.onVisible();
        })
        .catch(() => {
          if (!isOpen || isDestroyed || token !== transitionToken) return;
          resetOriginFlipSurface(origin);
          const snapshot = activeMotionSnapshot;
          if (snapshot) restoreMotionShell(snapshot);
          overlay.dataset.state = "open";
          resetOverlayVisuals();
          activeController?.onVisible();
        })
        .finally(() => {
          activeMotionSnapshot?.dispose();
          activeMotionSnapshot = null;
        });
    });

    queueMicrotask(() => closeButton.focus());
  }

  function finishClose(token: number, focusTarget: HTMLElement | null): void {
    if (token !== transitionToken || isDestroyed) return;

    activeController?.destroy();
    activeController = null;
    overlay.dataset.state = "closed";
    overlay.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    resetOverlayVisuals();
    delete shell.dataset.category;
    restoreBackgroundAccessibility(backgroundAccessibilityStates);
    backgroundAccessibilityStates = [];
    restoreOriginVisibility(focusTarget);
    setOriginFlipState(focusTarget, "front");
    resetOriginFlipSurface(focusTarget);
    leftSlot.replaceChildren(loadingNode("Loading deep dive..."));
    rightSlot.replaceChildren(loadingNode("Awaiting content..."));
    activeOrigin = null;
    activeOriginRect = null;

    if (focusTarget && focusTarget.isConnected) {
      queueMicrotask(() => focusTarget.focus());
    }
  }

  function close(): void {
    if (!isOpen) return;

    isOpen = false;
    const token = ++transitionToken;
    overlay.dataset.state = "closing";
    const focusTarget = activeOrigin;
    const originRect = activeOriginRect;
    disposeActiveSnapshot();

    if (prefersReducedMotion() || !originRect) {
      finishClose(token, focusTarget);
      return;
    }

    const snapshot = captureDeepDiveCloseSnapshot(shell, originRect, focusTarget);
    activeMotionSnapshot = snapshot;

    void playDeepDiveCloseMotion(snapshot, backdrop, shell)
      .then(async () => {
        snapshot.originClone.style.visibility = "hidden";
        setOriginFlipState(focusTarget, "front");
        restoreOriginVisibility(focusTarget);
        await playOriginFrontFlipIn(focusTarget);
        finishClose(token, focusTarget);
        restoreMotionShell(snapshot);
        snapshot.dispose();
        if (activeMotionSnapshot === snapshot) {
          activeMotionSnapshot = null;
        }
      })
      .catch(() => {
        resetOriginFlipSurface(focusTarget);
        finishClose(token, focusTarget);
        restoreMotionShell(snapshot);
      })
      .finally(() => {
        snapshot.dispose();
        if (activeMotionSnapshot === snapshot) {
          activeMotionSnapshot = null;
        }
      });
  }

  function destroy(): void {
    if (isDestroyed) return;
    isDestroyed = true;
    isOpen = false;
    activeController?.destroy();
    activeController = null;
    disposeActiveSnapshot();
    restoreOriginVisibility(activeOrigin);
    resetOriginFlipSurface(activeOrigin);
    restoreBackgroundAccessibility(backgroundAccessibilityStates);
    backgroundAccessibilityStates = [];
    resetOverlayVisuals();
    document.removeEventListener("keydown", handleKeydown);
    backdrop.removeEventListener("click", close);
    closeButton.removeEventListener("click", close);
    overlay.remove();
  }

  document.addEventListener("keydown", handleKeydown);
  backdrop.addEventListener("click", close);
  closeButton.addEventListener("click", close);

  leftSlot.appendChild(loadingNode("Loading deep dive..."));
  rightSlot.appendChild(loadingNode("Awaiting content..."));

  return { open, close, destroy };
}
