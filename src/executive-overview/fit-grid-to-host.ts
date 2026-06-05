const MIN_SCALE = 0.55;

function shouldScaleToFit(rows: HTMLElement): boolean {
  const raw = getComputedStyle(rows).getPropertyValue("--eo-scale-to-fit").trim();
  return raw === "1";
}

function measureGrid(rows: HTMLElement): { width: number; height: number } {
  return {
    width: rows.scrollWidth,
    height: rows.scrollHeight,
  };
}

function updateGridScale(scaleHost: HTMLElement, rows: HTMLElement): void {
  if (!shouldScaleToFit(rows)) {
    rows.style.zoom = "1";
    return;
  }

  rows.style.zoom = "1";
  const hostW = scaleHost.clientWidth;
  const hostH = scaleHost.clientHeight;
  const { width: contentW, height: contentH } = measureGrid(rows);
  if (!contentW || !contentH) return;

  const scale = Math.max(MIN_SCALE, Math.min(hostW / contentW, hostH / contentH));
  rows.style.zoom = String(scale);
}

/** Bind proportional zoom so the periodic table fills the scale host on desktop. */
export function attachGridScale(scaleHost: HTMLElement, rows: HTMLElement): () => void {
  const run = () => updateGridScale(scaleHost, rows);
  const observer = new ResizeObserver(run);
  observer.observe(scaleHost);
  window.addEventListener("resize", run);
  requestAnimationFrame(run);
  if (document.fonts?.ready) {
    document.fonts.ready.then(run);
  }
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", run);
  };
}
