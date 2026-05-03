/// <reference types="node" />
import { createRequire } from "node:module";
import type { Plugin as EsbuildPlugin } from "esbuild";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
/**
 * Resolved entry for venn.js's broken `../node_modules/fmin/index.js` import (must be absolute).
 * Use `fmin/index.js` (ESM → patched `src/*.js`), not `package.json` `main` (`build/fmin.js`), which
 * still ships the strict-mode `for (i = 1; …)` bug and breaks `computeTextCentres` in the browser.
 */
const fminResolved: string = require.resolve("fmin/index.js");

function isBrokenFminImport(path: string): boolean {
  const n = path.replace(/\\/g, "/");
  return (
    n === "../node_modules/fmin/index.js" ||
    n.endsWith("/../node_modules/fmin/index.js") ||
    n.includes("/node_modules/fmin/index.js")
  );
}

/**
 * venn.js `src/*.js` imports `../node_modules/fmin/index.js`, which does not exist when `fmin` is hoisted.
 * Vite `resolveId` does **not** run for esbuild's **dependency pre-bundle** (`vite dev`); use an esbuild `onResolve` hook too.
 */
function vennFminAlias(): Plugin {
  return {
    name: "venn-fmin-resolve",
    enforce: "pre",
    resolveId(id) {
      if (isBrokenFminImport(id)) return fminResolved;
      return undefined;
    },
  };
}

/** Same rewrite during `optimizeDeps` (esbuild), where the dev-server failure occurs. */
const vennFminEsbuild: EsbuildPlugin = {
  name: "venn-fmin-esbuild",
  setup(build) {
    build.onResolve({ filter: /fmin[/\\]index\.js$/ }, (args) => {
      if (isBrokenFminImport(args.path)) {
        return { path: fminResolved };
      }
      return undefined;
    });
  },
};

export default defineConfig({
  resolve: {
    alias: [
      /** Fallback for non-dev resolution paths */
      { find: "../node_modules/fmin/index.js", replacement: fminResolved },
    ],
  },
  plugins: [vennFminAlias()],
  optimizeDeps: {
    esbuildOptions: {
      plugins: [vennFminEsbuild],
    },
  },
  base: process.env.VITE_BASE_URL || "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
});
