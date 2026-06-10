const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

type InertCapableElement = Element & { inert?: boolean };

export type BackgroundAccessibilityState = {
  node: Element;
  ariaHidden: string | null;
  inert: boolean | undefined;
};

export function findFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((node) => {
    if (node.hidden) return false;
    if (node.getAttribute("aria-hidden") === "true") return false;
    if (node.tabIndex < 0) return false;
    return node.offsetParent !== null || node === document.activeElement;
  });
}

export function trapFocus(event: KeyboardEvent, container: HTMLElement): void {
  const focusable = findFocusable(container);
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeElement = document.activeElement as HTMLElement | null;

  if (event.shiftKey) {
    if (activeElement === first || !container.contains(activeElement)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }

  if (activeElement === last || !container.contains(activeElement)) {
    event.preventDefault();
    first.focus();
  }
}

export function hideBackgroundFromFocus(
  overlay: HTMLElement,
  host: HTMLElement,
): BackgroundAccessibilityState[] {
  const states = Array.from(host.children)
    .filter((node) => node !== overlay)
    .map((node) => {
      const inertNode = node as InertCapableElement;
      const state: BackgroundAccessibilityState = {
        node,
        ariaHidden: node.getAttribute("aria-hidden"),
        inert: inertNode.inert,
      };

      node.setAttribute("aria-hidden", "true");
      inertNode.inert = true;
      return state;
    });

  return states;
}

export function restoreBackgroundAccessibility(states: BackgroundAccessibilityState[]): void {
  for (const { node, ariaHidden, inert } of states) {
    if (ariaHidden === null) {
      node.removeAttribute("aria-hidden");
    } else {
      node.setAttribute("aria-hidden", ariaHidden);
    }

    (node as InertCapableElement).inert = inert;
  }
}
