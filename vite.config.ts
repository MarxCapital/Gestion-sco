import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Don't let the plugin inject its own <link rel="manifest"> — we inject
      // either manifest-client.json or manifest-admin.json from index.html
      // depending on the route, so the two PWAs (Client / Admin) coexist.
      injectRegister: null,
      manifest: false,
      includeAssets: [
        "gestionsco-favicon-2026.png",
        "gestionsco-logo-2026-192.png",
        "gestionsco-logo-2026-512.png",
        "gestionsco-admin-2026-192.png",
        "gestionsco-admin-2026-512.png",
        "manifest-client.json",
        "manifest-admin.json",
      ],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,pdf,webp,jpg}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/functions\//],
        runtimeCaching: [
          // Les données (REST) sont gérées par la passerelle hors ligne de l'application (copie locale + file d'attente).
          { urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i, handler: "NetworkOnly" },
          // Bibliothèques externes (ZIP, Excel, PDF) : gardées sur l'appareil après le premier chargement.
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "gestionsco-libs", expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "gestionsco-fonts", expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
          // Photos de profil / images publiques du stockage.
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "gestionsco-images", expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/v1\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
