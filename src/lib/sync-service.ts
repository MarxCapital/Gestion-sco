/**
 * Sync service: handles syncing offline data back to Supabase when online.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  getSyncQueue,
  removeSyncItem,
  setMeta,
  getPendingSyncCount,
} from "./offline-storage";
import { SUBJECTS } from "./calculations";

type SyncListener = (pending: number) => void;
const listeners: SyncListener[] = [];
let isSyncing = false;

export function onSyncChange(listener: SyncListener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyListeners(count: number) {
  listeners.forEach((l) => l(count));
}

export async function syncPendingData(): Promise<{ synced: number; failed: number }> {
  if (isSyncing || !navigator.onLine) return { synced: 0, failed: 0 };
  isSyncing = true;

  const queue = await getSyncQueue();
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.table === "notes" && item.operation === "upsert") {
        const row: any = { candidate_id: item.data.candidate_id };
        SUBJECTS.forEach((s) => {
          row[s.key] = item.data[s.key] ?? null;
        });
        const { error } = await supabase
          .from("notes")
          .upsert(row, { onConflict: "candidate_id" } as any);
        if (error) throw error;
      } else if (item.table === "candidates" && item.operation === "update") {
        const { id, ...rest } = item.data;
        const { error } = await supabase.from("candidates").update(rest).eq("id", id);
        if (error) throw error;
      }

      await removeSyncItem(item.id);
      synced++;
    } catch (e) {
      console.error("Sync failed for item:", item.id, e);
      failed++;
    }
  }

  await setMeta("last_sync", Date.now());
  const remaining = await getPendingSyncCount();
  notifyListeners(remaining);
  isSyncing = false;

  return { synced, failed };
}

// Auto-sync when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[Sync] Back online, syncing...");
    syncPendingData().then(({ synced, failed }) => {
      if (synced > 0) console.log(`[Sync] ${synced} items synced successfully`);
      if (failed > 0) console.warn(`[Sync] ${failed} items failed to sync`);
    });
  });
}
