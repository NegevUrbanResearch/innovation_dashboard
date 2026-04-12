/// <reference types="node" />
import { defineConfig } from "vite";

export default defineConfig({
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
