import { COPY } from "./executive-overview/copy";

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

/** Brand-only header — title + logos. No nav or toggles. */
export function mountAppHeader(root: HTMLElement): void {
  const header = el("header", "app-header");
  const brand = el("div", "brand");
  const brandLogos = el("div", "brand-logos");

  const logoWrap = el("div", "brand-logo-wrap");
  const logo = document.createElement("img");
  logo.className = "brand-logo";
  logo.src = `${import.meta.env.BASE_URL}id-logo.jpeg`;
  logo.alt = COPY.headerLogoAlt;
  logo.width = 160;
  logo.height = 200;
  logo.decoding = "async";
  logoWrap.appendChild(logo);

  const nurLogo = document.createElement("img");
  nurLogo.className = "brand-logo-nur";
  nurLogo.src = `${import.meta.env.BASE_URL}Nur%20Logo%20white.svg`;
  nurLogo.alt = COPY.headerNurLogoAlt;
  nurLogo.width = 333;
  nurLogo.height = 157;
  nurLogo.decoding = "async";

  brandLogos.appendChild(nurLogo);
  brandLogos.appendChild(logoWrap);

  const brandText = el("div", "brand-text");
  brandText.appendChild(el("h1", "brand-title", COPY.headerTitle));

  brand.appendChild(brandText);
  brand.appendChild(brandLogos);
  header.appendChild(brand);
  root.appendChild(header);
}
