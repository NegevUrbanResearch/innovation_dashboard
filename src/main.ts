import { applyLightTheme } from "./theme";
import { mountAppHeader } from "./app-header";
import { mountExecutiveOverview } from "./executive-overview/mount-executive-overview";
import "./app-reset.css";
import "./app-header.css";

applyLightTheme();

const root = document.querySelector<HTMLElement>("#app");
if (root) {
  root.classList.add("app-root");
  mountAppHeader(root);
  const main = document.createElement("main");
  main.className = "app-main";
  root.appendChild(main);
  void mountExecutiveOverview(main);
}
