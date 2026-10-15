import { useNetworkStatus } from "@/hooks/use-network-status";
import { Wifi, WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NetworkStatusBar = () => {
  const { isOnline, pendingSync, triggerSync } = useNetworkStatus();

  const handleSync = async () => {
    const { synced, failed } = await triggerSync();
    if (synced > 0) toast.success(`${synced} modification(s) synchronisée(s)`);
    if (failed > 0) toast.error(`${failed} erreur(s) de synchronisation`);
    if (synced === 0 && failed === 0) toast.info("Rien à synchroniser");
  };

  if (isOnline && pendingSync === 0) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-between text-sm ${
        isOnline
          ? "bg-amber-500/90 text-white"
          : "bg-destructive/90 text-destructive-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>{pendingSync} modification(s) en attente de synchronisation</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Mode hors ligne — les données sont sauvegardées localement</span>
            {pendingSync > 0 && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {pendingSync} en attente
              </span>
            )}
          </>
        )}
      </div>
      {isOnline && pendingSync > 0 && (
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={handleSync}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Synchroniser
        </Button>
      )}
    </div>
  );
};

export default NetworkStatusBar;
