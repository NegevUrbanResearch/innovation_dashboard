import { WIDEST_ROW_CARD_COUNT } from "./config";

const MIN_SCALE = 0.55;

function shouldScaleToFit(page: HTMLElement): boolean {
  const raw = getComputedStyle(page).getPropertyValue("--eo-scale-to-fit").trim();
  return raw === "1";
}

function measureGrid(grid: HTMLElement): { width: number; height: number } {
  return {
    width: grid.scrollWidth,
    height: grid.scrollHeight,
  };
}

function setCardWidthBoost(page: HTMLElement, boostPx: number): void {
  page.style.setProperty("--eo-card-width-boost", `${boostPx}px`);
}

function clearCardWidthBoost(page: HTMLElement): void {
  page.style.setProperty("--eo-card-width-boost", "0px");
}

function updateGridScale(
  scaleHost: HTMLElement,
  grid: HTMLElement,
  page: HTMLElement,
): void {
  if (!shouldScaleToFit(page)) {
    grid.style.zoom = "1";
    clearCardWidthBoost(page);
    return;
  }

  grid.style.zoom = "1";
  clearCardWidthBoost(page);

  const hostW = scaleHost.clientWidth;
  const hostH = scaleHost.clientHeight;
  let { width: contentW, height: contentH } = measureGrid(grid);
  if (!contentW || !contentH) return;

  const scaleW = hostW / contentW;
  const scaleH = hostH / contentH;

  // Height-limited: widen cards so the uniformly scaled grid also fills viewport width.
  if (scaleH < scaleW) {
    const heightScale = hostH / contentH;
    const targetW = hostW / heightScale;
    setCardWidthBoost(page, (targetW - contentW) / WIDEST_ROW_CARD_COUNT);
    contentW = measureGrid(grid).width;
  }

  let scale = Math.max(MIN_SCALE, Math.min(hostW / contentW, hostH / contentH));
  grid.style.zoom = String(scale);

  // Correct residual horizontal slack after zoom rounding.
  if (scaleH <= scaleW) {
    const renderedW = grid.getBoundingClientRect().width;
    const slack = hostW - renderedW;
    if (slack > 1) {
      const currentBoost = Number.parseFloat(
        getComputedStyle(page).getPropertyValue("--eo-card-width-boost"),
      );
      const added = slack / scale / WIDEST_ROW_CARD_COUNT;
      setCardWidthBoost(page, currentBoost + added);
      contentW = measureGrid(grid).width;
      scale = Math.max(MIN_SCALE, Math.min(hostW / contentW, hostH / contentH));
      grid.style.zoom = String(scale);
    }
  }
}

/** Bind proportional zoom so the periodic table fills the scale host on desktop. */
export function attachGridScale(
  scaleHost: HTMLElement,
  grid: HTMLElement,
  page: HTMLElement,
): () => void {
  const run = () => updateGridScale(scaleHost, grid, page);
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
