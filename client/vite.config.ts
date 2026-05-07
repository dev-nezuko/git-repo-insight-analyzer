import { cwd } from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Use process.cwd(), not dirname(import.meta.url). Vite pre-bundles this config file;
 * then import.meta.url points at a temp .mjs under .vite/, so deriving "root" from it
 * breaks production builds on CI (wrong root → no bundle → missing dist/index.html).
 */
export default defineConfig({
  root: cwd(),
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
