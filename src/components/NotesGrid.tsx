import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, WifiOff } from "lucide-react";
import { SUBJECTS, type CandidateRow, type NotesRow, computeResults, sortByOrder } from "@/lib/calculations";
import {
  saveCandidatesOffline,
  getCandidatesOffline,
  saveNotesOffline,
  getAllNotesOffline,
  saveAllNotesOffline,
  addToSyncQueue,
  getPendingSyncCount,
} from "@/lib/offline-storage";
import { syncPendingData } from "@/lib/sync-service";
import { getSchoolYear } from "@/lib/school-year";
import { useSchoolYear } from "@/contexts/SchoolYearContext";
import SkeletonLoader from "@/components/portal/SkeletonLoader";

interface Props {
  centerId: string;
}

const NotesGrid = ({ centerId }: Props) => {
  const [candidates, setCandidates] = useState<(CandidateRow & { notes: NotesRow | null })[]>([]);
  const [localNotes, setLocalNotes] = useState<Record<string, Record<string, number | null>>>({});
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const { readOnly } = useSchoolYear();
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    if (true /* hors ligne : géré par la passerelle */) {
      try {
        const { data, error } = await supabase
          .from("candidates")
          .select("*, notes(*)")
          .eq("school_year", getSchoolYear())
          .eq("center_id", centerId)
          .order("nom");

        if (error) throw error;

        const sorted = sortByOrder((data || []) as (CandidateRow & { notes: NotesRow | null })[]);
        setCandidates(sorted);

        // Cache to IndexedDB
        await saveCandidatesOffline(sorted.map((c: any) => ({ ...c, notes: undefined })));
        const notesList = sorted
          .filter((c: any) => c.notes)
          .map((c: any) => ({ candidate_id: c.id, ...c.notes }));
        if (notesList.length > 0) await saveAllNotesOffline(notesList);

        const notesMap: Record<string, Record<string, number | null>> = {};
        sorted.forEach((c: any) => {
          if (c.notes) {
            const n: Record<string, number | null> = {};
            SUBJECTS.forEach((s) => { n[s.key] = c.notes[s.key] ?? null; });
            notesMap[c.id] = n;
          }
        });
        setLocalNotes(notesMap);

        // Sync any pending offline changes
        syncPendingData();
      } catch {
        // Network failed, fall back to offline
        await loadFromOffline();
      }
    } else {
      await loadFromOffline();
    }

    setLoading(false);
  }, [centerId]);

  const loadFromOffline = async () => {
    const offlineCandidates = await getCandidatesOffline(centerId);
    const offlineNotes = await getAllNotesOffline();
    const sorted = sortByOrder(
      offlineCandidates.map((c) => ({
        ...c,
        notes: offlineNotes.find((n) => n.candidate_id === c.id) || null,
      }))
    );
    setCandidates(sorted);

    const notesMap: Record<string, Record<string, number | null>> = {};
    sorted.forEach((c: any) => {
      if (c.notes) {
        const n: Record<string, number | null> = {};
        SUBJECTS.forEach((s) => { n[s.key] = c.notes[s.key] ?? null; });
        notesMap[c.id] = n;
      }
    });
    setLocalNotes(notesMap);
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    return () => {
      debounceTimers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const saveNotes = useCallback(async (candidateId: string, notes: Record<string, number | null>) => {
    setSavingIds((prev) => new Set(prev).add(candidateId));
    setSavedIds((prev) => { const n = new Set(prev); n.delete(candidateId); return n; });

    // Always save to IndexedDB first
    const offlineData: any = { candidate_id: candidateId };
    SUBJECTS.forEach((s) => { offlineData[s.key] = notes[s.key] ?? null; });
    await saveNotesOffline(candidateId, offlineData);

    let success = false;

    if (true /* hors ligne : géré par la passerelle */) {
      try {
        const row: any = { candidate_id: candidateId };
        SUBJECTS.forEach((s) => { row[s.key] = notes[s.key] ?? null; });
        const { error } = await supabase.from("notes").upsert(row, { onConflict: "candidate_id" } as any);
        if (error) throw error;
        success = true;
      } catch {
        // Queue for later sync
        await addToSyncQueue({ table: "notes", operation: "upsert", data: offlineData });
      }
    } else {
      // Queue for later sync
      await addToSyncQueue({ table: "notes", operation: "upsert", data: offlineData });
      success = true; // Saved offline successfully
    }

    setSavingIds((prev) => { const n = new Set(prev); n.delete(candidateId); return n; });

    if (success) {
      setSavedIds((prev) => new Set(prev).add(candidateId));
      setTimeout(() => setSavedIds((prev) => { const n = new Set(prev); n.delete(candidateId); return n; }), 2000);
    }
  }, []);

  const scheduleSave = useCallback((candidateId: string, notes: Record<string, number | null>) => {
    const existing = debounceTimers.current.get(candidateId);
    if (existing) clearTimeout(existing);
    debounceTimers.current.set(candidateId, setTimeout(() => {
      saveNotes(candidateId, notes);
      debounceTimers.current.delete(candidateId);
    }, 800));
  }, [saveNotes]);

  const handleChange = (candidateId: string, subject: string, value: string) => {
    const numVal = value === "" ? null : parseFloat(value);
    if (numVal !== null && (isNaN(numVal) || numVal < 0 || numVal > 20)) return;
    const updated = { ...(localNotes[candidateId] || {}), [subject]: numVal };
    setLocalNotes((prev) => ({ ...prev, [candidateId]: updated }));
    scheduleSave(candidateId, updated);
  };

  const handleBlur = async (candidateId: string) => {
    const existing = debounceTimers.current.get(candidateId);
    if (existing) {
      clearTimeout(existing);
      debounceTimers.current.delete(candidateId);
    }
    const notes = localNotes[candidateId];
    if (!notes) return;
    await saveNotes(candidateId, notes);
  };

  const moveToNextRow = (rowIdx: number, colIdx: number) => {
    let next = rowIdx + 1;
    while (next < candidates.length && candidates[next].is_absent) next++;
    if (next < candidates.length) {
      inputRefs.current.get(`${next}-${colIdx}`)?.focus();
    }
  };

  const moveToPrevRow = (rowIdx: number, colIdx: number) => {
    let prev = rowIdx - 1;
    while (prev >= 0 && candidates[prev].is_absent) prev--;
    if (prev >= 0) {
      inputRefs.current.get(`${prev}-${colIdx}`)?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      moveToNextRow(rowIdx, colIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveToPrevRow(rowIdx, colIdx);
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      if (colIdx < SUBJECTS.length - 1) {
        inputRefs.current.get(`${rowIdx}-${colIdx + 1}`)?.focus();
      } else {
        let next = rowIdx + 1;
        while (next < candidates.length && candidates[next].is_absent) next++;
        if (next < candidates.length) inputRefs.current.get(`${next}-0`)?.focus();
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) {
        inputRefs.current.get(`${rowIdx}-${colIdx - 1}`)?.focus();
      } else {
        let prev = rowIdx - 1;
        while (prev >= 0 && candidates[prev].is_absent) prev--;
        if (prev >= 0) inputRefs.current.get(`${prev}-${SUBJECTS.length - 1}`)?.focus();
      }
    } else if (e.key === "ArrowRight") {
      const input = e.currentTarget as HTMLInputElement;
      if (input.selectionStart === input.value.length) {
        e.preventDefault();
        if (colIdx < SUBJECTS.length - 1) inputRefs.current.get(`${rowIdx}-${colIdx + 1}`)?.focus();
      }
    } else if (e.key === "ArrowLeft") {
      const input = e.currentTarget as HTMLInputElement;
      if (input.selectionStart === 0) {
        e.preventDefault();
        if (colIdx > 0) inputRefs.current.get(`${rowIdx}-${colIdx - 1}`)?.focus();
      }
    }
  };

  const results = computeResults(
    candidates.map((c) => ({
      ...c,
      notes: localNotes[c.id]
        ? ({ candidate_id: c.id, ...Object.fromEntries(SUBJECTS.map((s) => [s.key, null])), ...localNotes[c.id] } as NotesRow)
        : c.notes,
    }))
  );

  if (loading) return <SkeletonLoader rows={7} />;
  if (candidates.length === 0) return <p className="text-muted-foreground">Aucun candidat. L'administrateur doit d'abord importer la liste.</p>;

  return (
    <div className="max-w-full overflow-x-auto">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          Navigation : <kbd className="px-1 bg-muted rounded">Tab</kbd> colonne suivante · <kbd className="px-1 bg-muted rounded">Entrée</kbd> ligne suivante
        </p>
        <div className="flex items-center gap-2">
          {isOffline && (
            <span className="text-xs flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded">
              <WifiOff className="w-3 h-3" /> Hors ligne
            </span>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-600" /> Sauvegarde automatique
          </p>
        </div>
      </div>
      <table className="portal-table text-xs">
        <thead>
          <tr>
            <th className="p-1 border border-border text-left min-w-[60px]">N° Table</th>
            <th className="p-1 border border-border text-left min-w-[100px]">Nom</th>
            <th className="p-1 border border-border text-left min-w-[100px]">Prénom(s)</th>
            {SUBJECTS.map((s) => (
              <th key={s.key} className="p-1 border border-border text-center min-w-[55px]">{s.label}</th>
            ))}
            <th className="p-1 border border-sidebar-border text-center min-w-[50px]">Total</th>
            <th className="p-1 border border-sidebar-border text-center min-w-[50px]">Moy.</th>
            <th className="p-1 border border-sidebar-border text-center min-w-[40px]">Rang</th>
            <th className="p-1 border border-sidebar-border text-center min-w-[40px]">Seuil</th>
            <th className="p-1 border border-border text-center min-w-[30px]"></th>
          </tr>
        </thead>
        <tbody>
          {results.map((c, rowIdx) => (
            <tr key={c.id} className={c.is_absent ? "bg-destructive/10 opacity-50" : ""}>
              <td className="p-1 border border-border">{c.numero_table}</td>
              <td className="p-1 border border-border font-medium">{c.nom}</td>
              <td className="p-1 border border-border">{c.prenoms}</td>
              {SUBJECTS.map((s, colIdx) => (
                <td key={s.key} className="p-0 border border-border">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      moveToNextRow(rowIdx, colIdx);
                    }}
                    style={{ margin: 0 }}
                  >
                    <input
                      ref={(el) => { if (el) inputRefs.current.set(`${rowIdx}-${colIdx}`, el); }}
                      type="number"
                      inputMode="decimal"
                      enterKeyHint="next"
                      min="0"
                      max="20"
                      step="any"
                      disabled={c.is_absent || readOnly}
                      value={localNotes[c.id]?.[s.key] ?? ""}
                      onChange={(e) => handleChange(c.id, s.key, e.target.value)}
                      onBlur={() => handleBlur(c.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                      className="w-full h-7 text-center text-xs p-0 border-0 outline-none focus:bg-primary/5"
                      style={{ MozAppearance: "textfield" }}
                    />
                  </form>
                </td>
              ))}
              <td className="p-1 border border-border text-center font-semibold bg-primary/5">{c.total?.toFixed(2) ?? "-"}</td>
              <td className="p-1 border border-border text-center font-semibold bg-primary/5">{c.moyenne?.toFixed(2) ?? "-"}</td>
              <td className="p-1 border border-border text-center font-bold bg-primary/5">{c.rang ?? "-"}</td>
              <td className={`p-1 border border-border text-center font-bold ${c.seuilAtteint ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}>
                {c.is_absent ? "-" : c.seuilAtteint ? "✓" : "✗"}
              </td>
              <td className="p-1 border border-border text-center w-6">
                {savingIds.has(c.id) && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground mx-auto" />}
                {savedIds.has(c.id) && <CheckCircle2 className="w-3 h-3 text-green-600 mx-auto" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default NotesGrid;
