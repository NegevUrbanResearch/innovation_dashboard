import assert from "node:assert/strict";
import test from "node:test";

import { buildOverlayMotionDefinition } from "./overlay-motion.ts";

test("buildOverlayMotionDefinition falls back to the shared overlay entrance when origin is unavailable", () => {
  const motion = buildOverlayMotionDefinition(null, {
    left: 24,
    top: 24,
    width: 960,
    height: 640,
  });

  assert.deepEqual(motion.backdropOpacity, [0, 1]);
  assert.deepEqual(motion.shellOpacity, [0, 1]);
  assert.equal(
    motion.shellTransform[0],
    "translate3d(0, 18px, 0) scale(0.985) rotateX(-4deg)",
  );
  assert.equal(motion.shellTransformOrigin, "50% 0%");
});

test("buildOverlayMotionDefinition anchors overlay growth to the card origin rect", () => {
  const motion = buildOverlayMotionDefinition(
    {
      left: 100,
      top: 180,
      width: 214,
      height: 155,
    },
    {
      left: 40,
      top: 40,
      width: 1080,
      height: 720,
    },
  );

  assert.deepEqual(motion.backdropOpacity, [0, 1]);
  assert.deepEqual(motion.shellOpacity, [0.44, 1]);
  assert.match(
    motion.shellTransform[0],
    /translate3d\(-373px, -142\.5px, 0\) scale\(0\.198, 0\.215\) rotateX\(-11\.226deg\)/,
  );
  assert.equal(motion.shellTransform[1], "translate3d(0, 0, 0) scale(1) rotateX(0deg)");
  assert.equal(motion.shellTransformOrigin, "15.463% 28%");
});

type Listener = (...args: unknown[]) => void;

class FakeDomRect {
  public left: number;
  public top: number;
  public width: number;
  public height: number;

  constructor(left = 0, top = 0, width = 0, height = 0) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
  }
}

class FakeElement {
  public children: FakeElement[] = [];
  public parentNode: FakeElement | null = null;
  public hidden = false;
  public dataset: Record<string, string> = {};
  public style: Record<string, string> = {};
  public className = "";
  public id = "";
  public textContent: string | null = null;
  public tabIndex = 0;
  public type = "";
  public inert: boolean | undefined;
  public ownerDocument: FakeDocument;
  public tagName: string;
  private attributes = new Map<string, string>();
  private listeners = new Map<string, Listener[]>();

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  get isConnected(): boolean {
    return this === this.ownerDocument.body || this.parentNode?.isConnected === true;
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...nodes: FakeElement[]): void {
    for (const node of nodes) this.appendChild(node);
  }

  replaceChildren(...nodes: FakeElement[]): void {
    for (const child of this.children) {
      child.parentNode = null;
    }
    this.children = [];
    for (const node of nodes) this.appendChild(node);
  }

  remove(): void {
    if (!this.parentNode) return;
    const siblings = this.parentNode.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentNode = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type);
    if (!listeners) return;
    this.listeners.set(
      type,
      listeners.filter((entry) => entry !== listener),
    );
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  querySelectorAll<T extends FakeElement>(_selector: string): T[] {
    return [];
  }

  querySelector<T extends FakeElement>(_selector: string): T | null {
    return null;
  }

  getBoundingClientRect(): FakeDomRect {
    return new FakeDomRect(100, 120, 214, 155);
  }
}

class FakeDocument {
  public activeElement: FakeElement | null = null;
  public body: FakeElement;
  private listeners = new Map<string, Listener[]>();

  constructor() {
    this.body = new FakeElement(this, "body");
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type);
    if (!listeners) return;
    this.listeners.set(
      type,
      listeners.filter((entry) => entry !== listener),
    );
  }
}

test("open then reopen then close restores original sibling accessibility state", async () => {
  const fakeDocument = new FakeDocument();
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousDomRect = globalThis.DOMRect;
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;

  Object.assign(globalThis, {
    document: fakeDocument,
    window: {
      matchMedia: () => ({ matches: true }),
    },
    DOMRect: FakeDomRect,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  });

  try {
    const { mountDeepDiveOverlayController } = await import("./deep-dive-overlay-controller.ts");

    const host = fakeDocument.createElement("div");
    fakeDocument.body.appendChild(host);

    const origin = fakeDocument.createElement("button");
    origin.setAttribute("aria-hidden", "false");
    origin.inert = false;

    const sibling = fakeDocument.createElement("section");
    sibling.inert = true;

    host.append(origin, sibling);

    const overlay = mountDeepDiveOverlayController(
      host as unknown as HTMLElement,
      () => ({
        destroy() {},
        onVisible() {},
      }),
    );
    const card = {
      kpiName: "Test KPI",
      deepDive: { id: "real-estate-deals", label: "Open deep dive" },
    } as any;

    overlay.open(card, origin as unknown as HTMLElement);
    overlay.open(card, origin as unknown as HTMLElement);
    overlay.close();

    assert.equal(origin.getAttribute("aria-hidden"), "false");
    assert.equal(origin.inert, false);
    assert.equal(sibling.getAttribute("aria-hidden"), null);
    assert.equal(sibling.inert, true);
  } finally {
    if (previousDocument === undefined) {
      delete (globalThis as { document?: Document }).document;
    } else {
      globalThis.document = previousDocument;
    }

    if (previousWindow === undefined) {
      delete (globalThis as { window?: Window & typeof globalThis }).window;
    } else {
      globalThis.window = previousWindow;
    }

    if (previousDomRect === undefined) {
      delete (globalThis as { DOMRect?: typeof DOMRect }).DOMRect;
    } else {
      globalThis.DOMRect = previousDomRect;
    }

    if (previousRequestAnimationFrame === undefined) {
      delete (globalThis as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame;
    } else {
      globalThis.requestAnimationFrame = previousRequestAnimationFrame;
    }
  }
});
