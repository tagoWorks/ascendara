import MillionLint from "@million/lint";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const plugins = [react()];
plugins.unshift(MillionLint.vite());

export default defineConfig({
  plugins: plugins,
  root: path.join(__dirname, "src"),
  base: process.env.ELECTRON == "true" ? "./" : "/",
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "src"),
      },
    ],
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: path.join(__dirname, "build"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(__dirname, "src/main.jsx"),
    },
    assetsDir: "assets",
    sourcemap: true,
  },
});
