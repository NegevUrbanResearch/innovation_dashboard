export function eventTargetElement(target: EventTarget | null): Element | null {
  if (!target || !(target instanceof Node)) return null;
  return target instanceof Element ? target : target.parentElement;
}

export function anchorAtClientPoint(
  container: HTMLElement,
  x: number,
  y: number,
  selector: string,
  pad = 8,
): HTMLAnchorElement | null {
  const links = [...container.querySelectorAll<HTMLAnchorElement>(selector)];
  const hits = links.filter((a) => {
    const r = a.getBoundingClientRect();
    return (
      x >= r.left - pad &&
      x <= r.right + pad &&
      y >= r.top - pad &&
      y <= r.bottom + pad
    );
  });
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];
  hits.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const ac = (ar.left + ar.right) / 2;
    const bc = (br.left + br.right) / 2;
    return Math.abs(x - ac) - Math.abs(x - bc);
  });
  return hits[0] ?? null;
}

export function delegatedAnchorClick(
  container: HTMLElement,
  e: MouseEvent,
  selector: string,
): HTMLAnchorElement | null {
  const node = eventTargetElement(e.target);
  const direct = node?.closest(selector);
  if (direct instanceof HTMLAnchorElement && container.contains(direct)) return direct;

  return anchorAtClientPoint(container, e.clientX, e.clientY, selector, 10);
}
