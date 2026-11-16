import "@/lib/app-mode"; // Must run first: detects admin mode & swaps PWA manifest
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nouvelle version disponible. Mettre à jour ?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("[PWA] Application prête pour le mode hors ligne");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
