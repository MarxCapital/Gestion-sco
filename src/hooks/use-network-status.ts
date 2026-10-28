import { useState, useEffect, useCallback } from "react";
import { gateway } from "@/integrations/supabase/client";
import type { GatewayStatus } from "@/lib/offline/gateway";

/** État de la connexion et des modifications en attente (passerelle hors ligne). */
export function useNetworkStatus() {
  const [s, setS] = useState<GatewayStatus>(gateway.status());
  useEffect(() => {
    setS(gateway.status());
    void gateway.refreshCounts().catch(() => {});
    return gateway.subscribe(setS) as () => void;
  }, []);

  const triggerSync = useCallback(async () => {
    const up = gateway.down ? await gateway.probe() : true;
    if (!up) return { synced: 0, failed: 0 };
    const r = await gateway.flush();
    return { synced: r.sent, failed: r.failed };
  }, []);

  return { isOnline: !s.down, pendingSync: s.pending, failedSync: s.failed, syncing: s.syncing, needsLogin: s.needsLogin, prep: s.prep, readyAt: s.readyAt, triggerSync };
}
