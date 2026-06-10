class MockTextNode {
  textContent: string;

  constructor(textContent: string) {
    this.textContent = textContent;
  }

  get innerText(): string {
    return this.textContent;
  }
}

export class MockClassList {
  private readonly values = new Set<string>();

  reset(className: string): void {
    this.values.clear();
    this.add(...className.split(/\s+/).filter(Boolean));
  }

  add(...classNames: string[]): void {
    for (const className of classNames) {
      this.values.add(className);
    }
  }

  contains(className: string): boolean {
    return this.values.has(className);
  }

  toString(): string {
    return [...this.values].join(" ");
  }
}

export class MockNode {
  readonly tagName: string;
  readonly dataset: Record<string, string> = {};
  readonly attributes: Record<string, string> = {};
  readonly children: Array<MockNode | MockTextNode> = [];
  readonly classList = new MockClassList();
  textContent = "";
  dir = "";
  parent: MockNode | null = null;
  tabIndex = 0;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  set className(value: string) {
    this.classList.reset(value);
  }

  get className(): string {
    return this.classList.toString();
  }

  appendChild(child: MockNode | MockTextNode): MockNode | MockTextNode {
    if (child instanceof MockNode) {
      child.parent = this;
    }
    this.children.push(child);
    return child;
  }

  append(...nodes: Array<MockNode | MockTextNode | string>): void {
    for (const node of nodes) {
      this.appendChild(typeof node === "string" ? new MockTextNode(node) : node);
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  addEventListener(): void {}

  querySelector(selector: string): MockNode | null {
    const match = /^\.([\w-]+)$/.exec(selector);
    if (!match) return null;

    const className = match[1];
    const stack: MockNode[] = this.children.filter((child): child is MockNode => child instanceof MockNode);
    while (stack.length > 0) {
      const node = stack.shift()!;
      if (node.classList.contains(className)) {
        return node;
      }
      stack.push(...node.children.filter((child): child is MockNode => child instanceof MockNode));
    }

    return null;
  }

  get innerText(): string {
    return `${this.textContent}${this.children.map((child) => child.innerText).join("")}`;
  }
}

export function installMockDocument(): () => void {
  const previousDocument = globalThis.document;

  globalThis.document = {
    createElement: (tag: string) => new MockNode(tag),
    createElementNS: (_namespace: string, tag: string) => new MockNode(tag),
    createTextNode: (text: string) => new MockTextNode(text),
  } as unknown as Document;

  return () => {
    globalThis.document = previousDocument;
  };
}
