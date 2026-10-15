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
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        navigateFallbackDenylist: [/^\/functions\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24h
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
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
