import { renderRegisteredDeepDive } from "./deep-dive-registry";
import {
  captureDeepDiveCloseSnapshot,
  captureDeepDiveOpenSnapshot,
  playDeepDiveCloseMotion,
  playDeepDiveOpenMotion,
  playOriginFrontFlipIn,
  playOriginFrontFlipOut,
  resetOriginFlipSurface,
  type DeepDiveMotionSnapshot,
} from "./overlay-motion";
import type { DeepDiveController, KpiCardModel } from "./types";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export type DeepDiveOverlayController = {
  open(card: KpiCardModel, origin: HTMLElement): void;
  close(): void;
  destroy(): void;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

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

function getFocusableElements(scope: HTMLElement): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((node) => {
    if (node.hidden) return false;
    if (node.getAttribute("aria-hidden") === "true") return false;
    if (node.tabIndex < 0) return false;
    return node.offsetParent !== null || node === document.activeElement;
  });
}

export function mountKpiDeepDiveOverlay(host: HTMLElement): DeepDiveOverlayController {
  const overlay = el("section", "exec-deep-dive-overlay");
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.dataset.state = "closed";

  const backdrop = el("div", "exec-deep-dive-overlay__backdrop");
  backdrop.setAttribute("aria-hidden", "true");

  const shell = el("div", "exec-deep-dive-overlay__shell");
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "true");
  shell.setAttribute("aria-labelledby", "exec-deep-dive-overlay-title");

  const header = el("header", "exec-deep-dive-overlay__header");
  const titleBlock = el("div", "exec-deep-dive-overlay__title-block");
  const title = el("h2", "exec-deep-dive-overlay__title");
  title.id = "exec-deep-dive-overlay-title";
  titleBlock.appendChild(title);

  const closeButton = el("button", "exec-deep-dive-overlay__close", "Close");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close deep dive overlay");

  header.appendChild(titleBlock);
  header.appendChild(closeButton);

  const body = el("div", "exec-deep-dive-overlay__body");
  const leftSlot = el("div", "exec-deep-dive-overlay__panel exec-deep-dive-overlay__panel--left");
  const rightSlot = el("div", "exec-deep-dive-overlay__panel exec-deep-dive-overlay__panel--right");
  body.appendChild(leftSlot);
  body.appendChild(rightSlot);

  shell.appendChild(header);
  shell.appendChild(body);
  overlay.appendChild(backdrop);
  overlay.appendChild(shell);
  host.appendChild(overlay);

  let activeOrigin: HTMLElement | null = null;
  let activeOriginRect: DOMRect | null = null;
  let activeMotionSnapshot: DeepDiveMotionSnapshot | null = null;
  let isOpen = false;
  let isDestroyed = false;
  let activeController: DeepDiveController | null = null;
  let transitionToken = 0;
  const backgroundSiblings = Array.from(host.children).filter((node) => node !== overlay) as HTMLElement[];

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

  const restoreBackgroundAccessibility = () => {
    for (const node of backgroundSiblings) {
      if (node.dataset.overlayAriaHidden === "true") {
        node.setAttribute("aria-hidden", "true");
      } else {
        node.removeAttribute("aria-hidden");
      }
      delete node.dataset.overlayAriaHidden;

      if (node.dataset.overlayInert === "true") {
        node.inert = true;
      } else {
        node.inert = false;
      }
      delete node.dataset.overlayInert;
    }
  };

  const hideBackgroundFromFocus = () => {
    for (const node of backgroundSiblings) {
      node.dataset.overlayAriaHidden = node.getAttribute("aria-hidden") === "true" ? "true" : "false";
      node.dataset.overlayInert = node.inert ? "true" : "false";
      node.setAttribute("aria-hidden", "true");
      node.inert = true;
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

    const focusable = getFocusableElements(shell);
    if (!focusable.length) {
      event.preventDefault();
      shell.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (activeElement === first || !shell.contains(activeElement)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (activeElement === last || !shell.contains(activeElement)) {
      event.preventDefault();
      first.focus();
    }
  };

  function open(card: KpiCardModel, origin: HTMLElement): void {
    if (isDestroyed || !card.deepDive) return;

    const token = ++transitionToken;
    disposeActiveSnapshot();
    restoreOriginVisibility(activeOrigin);
    activeController?.destroy();
    activeController = null;

    setOriginFlipState(activeOrigin, "front");
    activeOrigin = origin;
    const originRect = origin.getBoundingClientRect();
    activeOriginRect = new DOMRect(originRect.left, originRect.top, originRect.width, originRect.height);
    title.textContent = card.kpiName;
    activeController = renderRegisteredDeepDive(card, leftSlot, rightSlot) || null;

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    overlay.dataset.state = "opening";
    isOpen = true;
    hideBackgroundFromFocus();

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
    restoreBackgroundAccessibility();
    restoreOriginVisibility(focusTarget);
    setOriginFlipState(focusTarget, "front");
    resetOriginFlipSurface(focusTarget);
    leftSlot.replaceChildren(el("div", "exec-deep-dive__loading-state", "Loading deep dive..."));
    rightSlot.replaceChildren(el("div", "exec-deep-dive__loading-state", "Awaiting content..."));
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
    restoreBackgroundAccessibility();
    resetOverlayVisuals();
    document.removeEventListener("keydown", handleKeydown);
    backdrop.removeEventListener("click", close);
    closeButton.removeEventListener("click", close);
    overlay.remove();
  }

  document.addEventListener("keydown", handleKeydown);
  backdrop.addEventListener("click", close);
  closeButton.addEventListener("click", close);

  shell.tabIndex = -1;
  leftSlot.appendChild(el("div", "exec-deep-dive__loading-state", "Loading deep dive..."));
  rightSlot.appendChild(el("div", "exec-deep-dive__loading-state", "Awaiting content..."));

  return { open, close, destroy };
}
