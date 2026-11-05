import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { gateway } from "@/integrations/supabase/client";
import { mirrorFor, currentScope } from "@/lib/offline/runtime";
import type { FailedEntry } from "@/lib/offline/mirror";
import { setActiveOffline } from "@/lib/offline/auth-offline";
import { SUPABASE_STORAGE_KEY, isAdminMode } from "@/lib/app-mode";
import { WifiOff, RefreshCw, Wifi, DownloadCloud, AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NetworkStatusBar = () => {
  const { isOnline, pendingSync, failedSync, syncing, needsLogin, prep, triggerSync } = useNetworkStatus();
  const [showFailed, setShowFailed] = useState(false);
  const [failed, setFailed] = useState<FailedEntry[]>([]);
  const [okFlash, setOkFlash] = useState(false);

  useEffect(() => { if (showFailed) void mirrorFor(currentScope()).backend.failedAll().then(setFailed); }, [showFailed, failedSync]);
  useEffect(() => {
    const h = () => { setOkFlash(true); setTimeout(() => setOkFlash(false), 3500); };
    window.addEventListener("gestionsco:synced", h);
    return () => window.removeEventListener("gestionsco:synced", h);
  }, []);

  const handleSync = async () => {
    const { synced, failed } = await triggerSync();
    if (synced > 0) toast.success(`${synced} modification(s) synchronisée(s)`);
    if (failed > 0) toast.error(`${failed} modification(s) refusée(s) par le serveur`);
    if (synced === 0 && failed === 0) toast.info(isOnline ? "Rien à synchroniser" : "Toujours pas de connexion internet");
  };

  const relogin = () => {
    setActiveOffline(null);
    try { localStorage.removeItem(SUPABASE_STORAGE_KEY); } catch { /* ignore */ }
    gateway.holdLocal = false;
    window.location.href = isAdminMode ? "/Marx" : "/login";
  };

  const clearFailed = async () => { await mirrorFor(currentScope()).backend.failedClear(); await gateway.refreshCounts(); setShowFailed(false); };

  const bar = "fixed bottom-0 left-0 right-0 z-50 px-3 py-2 flex items-center justify-between gap-2 text-sm";
  const Pending = pendingSync > 0 ? <span className="bg-white/25 px-2 py-0.5 rounded-full text-xs whitespace-nowrap">{pendingSync} en attente</span> : null;

  if (!isOnline) {
    return (
      <div className={`${bar} bg-destructive/95 text-destructive-foreground`}>
        <div className="flex items-center gap-2 min-w-0"><WifiOff className="w-4 h-4 shrink-0" /><span className="truncate">Mode hors ligne — tout est enregistré sur cet appareil</span>{Pending}</div>
        <Button size="sm" variant="secondary" className="h-7 text-xs shrink-0" onClick={handleSync}><RefreshCw className="w-3 h-3 mr-1" />Réessayer</Button>
      </div>
    );
  }
  if (needsLogin && pendingSync > 0) {
    return (
      <div className={`${bar} bg-amber-500/95 text-white`}>
        <div className="flex items-center gap-2 min-w-0"><LogIn className="w-4 h-4 shrink-0" /><span>Internet est de retour : reconnectez-vous pour envoyer vos modifications</span>{Pending}</div>
        <Button size="sm" variant="secondary" className="h-7 text-xs shrink-0" onClick={relogin}>Se reconnecter</Button>
      </div>
    );
  }
  if (pendingSync > 0) {
    return (
      <div className={`${bar} bg-amber-500/95 text-white`}>
        <div className="flex items-center gap-2"><Wifi className="w-4 h-4" /><span>{syncing ? "Envoi des modifications…" : `${pendingSync} modification(s) en attente de synchronisation`}</span></div>
        <Button size="sm" variant="secondary" className="h-7 text-xs" disabled={syncing} onClick={handleSync}><RefreshCw className={`w-3 h-3 mr-1 ${syncing ? "animate-spin" : ""}`} />Synchroniser</Button>
      </div>
    );
  }
  if (failedSync > 0) {
    return (
      <div className={`${bar} flex-col items-stretch bg-destructive/95 text-destructive-foreground`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{failedSync} modification(s) faite(s) hors ligne refusée(s) par le serveur</span></div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setShowFailed(v => !v)}>{showFailed ? "Masquer" : "Détails"}</Button>
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={clearFailed}>Ignorer</Button>
          </div>
        </div>
        {showFailed && <ul className="mt-1 max-h-32 overflow-auto text-xs space-y-1">{failed.map((f, i) => <li key={i} className="bg-white/15 rounded px-2 py-1"><b>{f.table}</b> ({f.method}) — {f.message}</li>)}</ul>}
      </div>
    );
  }
  if (prep) {
    return <div className={`${bar} bg-primary/95 text-primary-foreground`}><div className="flex items-center gap-2"><DownloadCloud className="w-4 h-4 animate-pulse" /><span>Préparation du mode hors ligne… {prep.done}/{prep.total}</span></div></div>;
  }
  if (okFlash) {
    return <div className={`${bar} bg-emerald-600/95 text-white`}><div className="flex items-center gap-2"><Wifi className="w-4 h-4" /><span>Modifications synchronisées</span></div></div>;
  }
  return null;
};

export default NetworkStatusBar;
