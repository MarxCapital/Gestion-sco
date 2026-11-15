/**
 * Shared helpers to load offline data (candidates + notes) from IndexedDB.
 */
import { getCandidatesOffline, getAllNotesOffline } from "./offline-storage";
import { sortAlphabetically, type CandidateRow, type NotesRow } from "./calculations";

export async function getOfflineCandidates(centerId?: string): Promise<CandidateRow[]> {
  const candidates = await getCandidatesOffline(centerId);
  return sortAlphabetically(candidates);
}

export async function getOfflineCandidatesWithNotes(
  centerId?: string
): Promise<(CandidateRow & { notes: NotesRow | null })[]> {
  const [candidates, allNotes] = await Promise.all([
    getCandidatesOffline(centerId),
    getAllNotesOffline(),
  ]);

  const notesMap = new Map<string, any>();
  allNotes.forEach((n) => notesMap.set(n.candidate_id, n));

  const merged = candidates.map((c) => ({
    ...c,
    notes: notesMap.get(c.id) || null,
  }));

  return sortAlphabetically(merged);
}
