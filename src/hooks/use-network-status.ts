import { useState, useEffect, useCallback } from "react";
import { getPendingSyncCount } from "@/lib/offline-storage";
import { onSyncChange, syncPendingData } from "@/lib/sync-service";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Load pending count
    getPendingSyncCount().then(setPendingSync);

    // Listen for sync changes
    const unsub = onSyncChange(setPendingSync);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsub();
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (isOnline) {
      return syncPendingData();
    }
    return { synced: 0, failed: 0 };
  }, [isOnline]);

  return { isOnline, pendingSync, triggerSync };
}
