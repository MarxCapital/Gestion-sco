import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Link2, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { nameKey } from "@/lib/photo-library";
import { createLink, dataUrlToBlob, linkStatus, pullSignatures, revokeLink, signUrl, type LinkStatus } from "@/lib/signature-link";

interface Pupil { lastName: string; firstName: string }
interface Props {
  scope: string;
  schoolName: string;
  students: Pupil[];
  /** Enregistre la signature reçue sur la carte de l'apprenant. */
  onReceive: (lastName: string, firstName: string, png: Blob) => Promise<void>;
}

const tokKey = (scope: string) => `gestionsco.siglink.${scope}`;
const readTok = (scope: string) => { try { return localStorage.getItem(tokKey(scope)) || ""; } catch { return ""; } };

/** Compte prestataire : lien à envoyer au directeur. Les signatures faites par les apprenants arrivent d'elles-mêmes sur leurs cartes. */
export default function RemoteSignPanel({ scope, schoolName, students, onReceive }: Props) {
  const [token, setToken] = useState(() => readTok(scope));
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [busy, setBusy] = useState<"" | "create" | "pull" | "revoke">("");
  const [err, setErr] = useState("");
  const lastPull = useRef(0);
  const studentsRef = useRef(students); studentsRef.current = students;
  const onReceiveRef = useRef(onReceive); onReceiveRef.current = onReceive;
  useEffect(() => { setToken(readTok(scope)); setStatus(null); setErr(""); }, [scope]);

  const pull = useCallback(async (tok: string, all = false, quiet = true) => {
    try {
      const st = await linkStatus(tok);
      setStatus(st); setErr("");
      if (!st) { if (!quiet) toast.error("Lien introuvable."); return; }
      if (!all && st.pending === 0) return;
      const got = await pullSignatures(tok, all);
      const byKey = new Map(studentsRef.current.map(s => [nameKey(s.lastName, s.firstName), s]));
      let n = 0;
      for (const g of got) {
        const s = byKey.get(g.student_key); if (!s) continue;
        await onReceiveRef.current(s.lastName, s.firstName, await dataUrlToBlob(g.png)); n++;
      }
      if (n) toast.success(`${n} signature(s) reçue(s) : elles sont sur les cartes.`);
      else if (!quiet) toast.info("Aucune nouvelle signature.");
      const st2 = await linkStatus(tok); setStatus(st2);
    } catch (e) { if (!quiet) toast.error(e instanceof Error ? e.message : "Erreur"); setErr(e instanceof Error ? e.message : "Erreur"); }
  }, []);

  // Vérification régulière tant que cette étape est ouverte.
  useEffect(() => {
    if (!token) return;
    let on = true;
    pull(token);
    const id = window.setInterval(() => { if (on && document.visibilityState === "visible") pull(token); }, 12000);
    return () => { on = false; window.clearInterval(id); };
  }, [token, pull]);

  const create = async () => {
    if (!students.length) { toast.error("Aucun apprenant dans la liste."); return; }
    setBusy("create"); setErr("");
    try {
      const tok = await createLink(scope, schoolName, students.map(s => ({ k: nameKey(s.lastName, s.firstName), nom: s.lastName, pre: s.firstName })));
      try { localStorage.setItem(tokKey(scope), tok); } catch { /* ignore */ }
      setToken(tok);
      toast.success("Lien prêt. Envoyez-le au directeur.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(""); }
  };
  const revoke = async () => {
    if (!window.confirm("Désactiver ce lien ? Le directeur ne pourra plus l'utiliser (les signatures déjà reçues sont conservées).")) return;
    setBusy("revoke");
    try { await revokeLink(token); try { localStorage.removeItem(tokKey(scope)); } catch { /* */ } setToken(""); setStatus(null); toast.success("Lien désactivé."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(""); }
  };

  const url = token ? signUrl(token) : "";
  const message = `Bonjour, voici le lien pour faire signer les apprenants de ${schoolName || "l'école"} (carte scolaire). Ouvrez-le sur un téléphone, puis donnez-le à chaque apprenant pour qu'il signe : ${url}`;
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast.success("Lien copié."); } catch { window.prompt("Copiez ce lien :", url); } };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Signatures des apprenants", text: message }); return; } catch { /* annulé */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  };
  const expired = status && !status.active;

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div>
        <p className="text-sm font-medium flex items-center gap-2"><Link2 className="h-4 w-4" />Faire signer par le directeur, à distance</p>
        <p className="text-xs text-muted-foreground">Envoyez un lien au directeur : il l'ouvre sur son téléphone et fait signer chaque apprenant. Chaque signature arrive directement sur la carte de l'apprenant concerné.</p>
      </div>
      {!token || expired ? (
        <Button size="sm" disabled={busy !== ""} onClick={create}>{busy === "create" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}{expired ? "Créer un nouveau lien" : "Créer le lien de signature"}</Button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input readOnly value={url} onFocus={e => e.currentTarget.select()} className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-xs" aria-label="Lien de signature" />
            <Button size="sm" variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-1" />Copier</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={share}><Send className="h-4 w-4 mr-1" />Envoyer au directeur</Button>
            <Button size="sm" variant="outline" disabled={busy !== ""} onClick={async () => { setBusy("pull"); await pull(token, true, false); setBusy(""); }}>{busy === "pull" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Récupérer les signatures</Button>
            <Button size="sm" variant="outline" disabled={busy !== ""} onClick={create}>Mettre à jour la liste d'élèves</Button>
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy !== ""} onClick={revoke}><Trash2 className="h-4 w-4 mr-1" />Désactiver</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {status ? `${status.received} signature(s) reçue(s) sur ${students.length}. ` : ""}Le lien reste valable 21 jours. La liste se vérifie toute seule toutes les 12 secondes.
          </p>
        </div>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
