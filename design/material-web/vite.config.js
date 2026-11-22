import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { campusApi } from "./campus-server.js";
export default defineConfig(({ command }) => ({
  plugins: [vue(), ...(command === "serve" ? [campusApi()] : [])],
  base: "./",
}));
