/**
 * Offline storage layer using IndexedDB for GestionSco PWA.
 * Stores candidates, notes, and pending sync queue.
 */

const DB_NAME = "gestionsco-offline";
const DB_VERSION = 1;

interface PendingSyncItem {
  id: string;
  table: string;
  operation: "upsert" | "update" | "delete";
  data: any;
  timestamp: number;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("candidates")) {
        db.createObjectStore("candidates", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("notes")) {
        const notesStore = db.createObjectStore("notes", { keyPath: "candidate_id" });
        notesStore.createIndex("candidate_id", "candidate_id", { unique: true });
      }
      if (!db.objectStoreNames.contains("sync_queue")) {
        const syncStore = db.createObjectStore("sync_queue", { keyPath: "id" });
        syncStore.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

// Generic helpers
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getByKey<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putItem(storeName: string, item: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function putMany(storeName: string, items: any[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    items.forEach((item) => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteItem(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ====== Public API ======

// Candidates
export async function saveCandidatesOffline(candidates: any[]): Promise<void> {
  await putMany("candidates", candidates);
}

export async function getCandidatesOffline(centerId?: string): Promise<any[]> {
  const all = await getAll<any>("candidates");
  return centerId ? all.filter((c) => c.center_id === centerId) : all;
}

// Notes
export async function saveNotesOffline(candidateId: string, notes: any): Promise<void> {
  await putItem("notes", { candidate_id: candidateId, ...notes });
}

export async function getNotesOffline(candidateId: string): Promise<any | undefined> {
  return getByKey("notes", candidateId);
}

export async function getAllNotesOffline(): Promise<any[]> {
  return getAll("notes");
}

export async function saveAllNotesOffline(notesList: any[]): Promise<void> {
  await putMany("notes", notesList);
}

// Sync Queue
export async function addToSyncQueue(item: Omit<PendingSyncItem, "id" | "timestamp">): Promise<void> {
  const syncItem: PendingSyncItem = {
    ...item,
    id: `${item.table}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  };
  await putItem("sync_queue", syncItem);
}

export async function getSyncQueue(): Promise<PendingSyncItem[]> {
  return getAll<PendingSyncItem>("sync_queue");
}

export async function removeSyncItem(id: string): Promise<void> {
  await deleteItem("sync_queue", id);
}

export async function clearSyncQueue(): Promise<void> {
  await clearStore("sync_queue");
}

// Meta (last sync time, etc.)
export async function setMeta(key: string, value: any): Promise<void> {
  await putItem("meta", { key, value });
}

export async function getMeta(key: string): Promise<any> {
  const item = await getByKey<{ key: string; value: any }>("meta", key);
  return item?.value;
}

// Pending sync count
export async function getPendingSyncCount(): Promise<number> {
  const queue = await getSyncQueue();
  return queue.length;
}
