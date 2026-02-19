import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("pdfjs-dist")) return "vendor-pdfjs";
          if (id.includes("pdf-lib")) return "vendor-pdflib";
          if (id.includes("jszip")) return "vendor-jszip";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    css: true,
    exclude: [...configDefaults.exclude, "playwright/**"],
  },
});
