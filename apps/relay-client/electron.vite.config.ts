import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import tailwind from "tailwindcss";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
      },
    },
    plugins: [react()],
    css: {
      postcss: {
        plugins: [tailwind, autoprefixer],
      },
    },
  },
});
