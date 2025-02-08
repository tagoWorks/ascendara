import MillionLint from "@million/lint";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const plugins = [react()];
plugins.unshift(MillionLint.vite());

// https://vitejs.dev/config/
export default defineConfig({
  plugins: plugins,
  root: path.join(__dirname, "src"),
  base: process.env.ELECTRON == "true" ? "./" : "/",
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),
    },
  },
  build: {
    outDir: path.join(__dirname, "src/dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(__dirname, "src/index.html"),
    },
    assetsDir: "assets",
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
