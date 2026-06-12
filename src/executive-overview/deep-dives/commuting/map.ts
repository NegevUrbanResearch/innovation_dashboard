const MAP_FILE = "mobility/zone_trip_map.html";

export type CommutingMapController = {
  reveal(): void;
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

function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

export function mountCommutingMap(host: HTMLElement): CommutingMapController {
  const shell = el("section", "exec-commuting-map");

  const header = el("div", "exec-commuting-map__header");
  header.appendChild(el("p", "exec-commuting-map__eyebrow", "Inbound work trips by origin zone"));
  header.appendChild(
    el(
      "p",
      "exec-commuting-map__caption",
      "Work-purpose trips into the Innovation District anchors, mapped to their residential origin zones.",
    ),
  );
  shell.appendChild(header);

  const stage = el("div", "exec-commuting-map__stage");
  shell.appendChild(stage);

  host.replaceChildren(shell);

  let destroyed = false;
  let iframe: HTMLIFrameElement | null = null;

  function load(): void {
    if (destroyed || iframe) return;

    const status = el("div", "exec-commuting-map__status", "Loading map...");
    stage.appendChild(status);

    iframe = document.createElement("iframe");
    iframe.className = "exec-commuting-map__frame";
    iframe.title = "Work-trip origin zones for the Innovation District";
    iframe.loading = "lazy";
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.addEventListener("load", () => {
      if (destroyed) return;
      iframe?.classList.add("exec-commuting-map__frame--ready");
      status.remove();
    });
    iframe.src = publicAssetUrl(MAP_FILE);
    stage.appendChild(iframe);
  }

  return {
    reveal() {
      load();
    },
    destroy() {
      destroyed = true;
      iframe?.remove();
      iframe = null;
      host.replaceChildren();
    },
  };
}
