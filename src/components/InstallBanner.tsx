import { useState, useEffect, useCallback } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallBannerProps {
  persistent?: boolean;
  adminMode?: boolean;
}

const InstallBanner = ({ persistent = false, adminMode = false }: InstallBannerProps) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Manifest swap is handled globally by src/lib/app-mode.ts

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) {
      setIsInstalled(true);
      return;
    }

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  if (isInstalled || isStandalone) return null;
  if (!persistent && dismissed) return null;

  const appName = adminMode ? "GestionSco Admin" : "GestionSco";

  return (
    <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-3 relative z-50">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Download className="w-5 h-5 flex-shrink-0 animate-bounce" />
        <p className="text-sm font-medium truncate">
          📲 Installez {appName} sur votre appareil pour un accès rapide !
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {deferredPrompt ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs font-semibold"
            onClick={handleInstall}
          >
            Installer
          </Button>
        ) : isIOS ? (
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-90 hidden sm:inline">
              Partager ↑ → Sur l'écran d'accueil
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs font-semibold sm:hidden"
              onClick={() => {
                alert(`Pour installer ${appName} sur iOS :\n\n1. Appuyez sur le bouton Partager (↑) en bas de Safari\n2. Sélectionnez "Sur l'écran d'accueil"\n3. Confirmez en appuyant sur "Ajouter"`);
              }}
            >
              Installer
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-90 hidden sm:inline">
              Menu → Ajouter à l'écran d'accueil
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs font-semibold sm:hidden"
              onClick={() => {
                alert(`Pour installer ${appName} :\n\n1. Ouvrez le menu de votre navigateur (⋮)\n2. Sélectionnez "Installer l'application" ou "Ajouter à l'écran d'accueil"\n3. Confirmez l'installation`);
              }}
            >
              Installer
            </Button>
          </div>
        )}
        {!persistent && (
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default InstallBanner;
