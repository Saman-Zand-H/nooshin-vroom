import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function staticRouteFallback(base: string): Plugin {
  return {
    name: "nooshin-static-route-fallback",
    generateBundle() {
      const root = JSON.stringify(base);
      this.emitFile({
        type: "asset",
        fileName: "route-fallback.js",
        source: `try{var route=location.pathname+location.search+location.hash;location.replace(${root}+"?__route="+encodeURIComponent(route))}catch(e){location.replace(${root})}`,
      });
      this.emitFile({
        type: "asset",
        fileName: "404.html",
        source: `<!doctype html><html><meta charset="utf-8"><title>Nooshin</title><script src="${base}route-fallback.js"></script></html>`,
      });
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, ".", "");
  const base = env.VITE_BASE_PATH || "/";
  if (!base.startsWith("/") || !base.endsWith("/") || base.startsWith("//"))
    throw new Error(
      "VITE_BASE_PATH must be a local path beginning and ending with /.",
    );
  if (command === "build" && mode !== "preview") {
    if (!env.VITE_DJANGO_API_URL && env.VITE_DJANGO_SAME_ORIGIN !== "true")
      throw new Error(
        "Private production requires VITE_DJANGO_API_URL, or set VITE_DJANGO_SAME_ORIGIN=true when Django serves the frontend. Use npm run build:preview only for a device-local preview.",
      );
    if (env.VITE_DJANGO_API_URL) {
      const url = new URL(env.VITE_DJANGO_API_URL);
      if (url.protocol !== "https:")
        throw new Error("Production Django API must use HTTPS.");
    }
  }
  return {
    base,
    build: {
      rollupOptions: {},
    },
    server: { host: "0.0.0.0", port: 5174, strictPort: true },
    plugins: [
      react(),
      staticRouteFallback(base),
      VitePWA({
        filename: "room-sw.js",
        registerType: "prompt",
        injectRegister: false,
        manifestFilename: "manifest.webmanifest",
        includeAssets: [
          "icon.svg",
          "icon-192.png",
          "icon-512.png",
          "apple-touch-icon.png",
          "art/night-window.svg",
        ],
        manifest: {
          id: base,
          scope: base,
          start_url: base,
          name: "For Nooshin",
          short_name: "For Nooshin",
          description:
            "A little universe for Nooshin — stories, songs, and worlds to get lost in.",
          display: "standalone",
          background_color: "#1b1320",
          theme_color: "#1b1320",
          icons: [
            {
              src: "icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          cacheId: "control-room-v6",
          globPatterns: ["**/*.{js,css,html,woff2,svg,png}"],
          globIgnores: [
            "sw.js",
            "**/*-ext-*",
            "**/*cyrillic*",
            "**/*vietnamese*",
            "**/*greek*",
          ],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/api\//, /\/auth\//, /\/callback/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // No API, auth, Google/Spotify responses, or private media runtime caches.
          runtimeCaching: [],
        },
      }),
    ],
  };
});
