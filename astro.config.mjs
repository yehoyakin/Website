// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Deployed as a GitHub Pages project site:
// https://yehoyakin.github.io/Website/
// The deploy workflow also passes these flags at build time.
export default defineConfig({
  site: "https://yehoyakin.github.io",
  base: "/Website",
  trailingSlash: "always",
  vite: {
    plugins: [tailwindcss()],
  },
});
