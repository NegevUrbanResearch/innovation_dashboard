export type DeepDiveShellElements = {
  overlay: HTMLElement;
  backdrop: HTMLDivElement;
  shell: HTMLDivElement;
  title: HTMLHeadingElement;
  closeButton: HTMLButtonElement;
  leftSlot: HTMLDivElement;
  rightSlot: HTMLDivElement;
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

export function loadingNode(text: string): HTMLDivElement {
  return el("div", "exec-deep-dive__loading-state", text);
}

export function createDeepDiveShell(): DeepDiveShellElements {
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
  shell.tabIndex = -1;

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

  return {
    overlay,
    backdrop,
    shell,
    title,
    closeButton,
    leftSlot,
    rightSlot,
  };
}
