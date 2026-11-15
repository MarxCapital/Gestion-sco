import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SignaturePad from "@/components/school/SignaturePad";
import { getPublicLink, submitSignature, type PublicLink } from "@/lib/signature-link";

/** Page publique (sans compte) : le directeur fait signer les apprenants sur son téléphone. */
export default function SignerPage() {
  const { token = "" } = useParams();
  const [link, setLink] = useState<PublicLink | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const [pad, setPad] = useState<null | { i: number; chain: boolean }>(null);

  const load = useCallback(async () => {
    try { setLink(await getPublicLink(token)); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); if (link === undefined) setLink(null); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const students = link?.students ?? [];
  const done = students.filter(s => s.signed).length;
  const markSigned = (k: string) => setLink(l => l && ({ ...l, students: l.students.map(s => (s.k === k ? { ...s, signed: true } : s)) }));

  if (link === undefined) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!link) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div className="max-w-sm space-y-2">
        <h1 className="text-lg font-semibold">Lien indisponible</h1>
        <p className="text-sm text-muted-foreground">{err || "Ce lien de signature est expiré ou a été désactivé. Demandez un nouveau lien à votre prestataire."}</p>
        {err && <Button variant="outline" onClick={load}>Réessayer</Button>}
      </div>
    </div>
  );

  const nextUnsigned = (from: number) => students.findIndex((s, k) => k > from && !s.signed);
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl p-4 space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-bold">Signatures des apprenants</h1>
          <p className="text-sm text-muted-foreground">{link.school || "École"} · carte scolaire</p>
          <p className="text-sm">Touchez « Faire signer à la suite » puis donnez le téléphone à chaque apprenant : il signe dans le rectangle. Sa signature est envoyée aussitôt et apparaît sur sa carte.</p>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={done === students.length} onClick={() => { const i = students.findIndex(s => !s.signed); if (i >= 0) setPad({ i, chain: true }); }}><PenLine className="h-4 w-4 mr-1" />Faire signer à la suite</Button>
          <span className="text-sm text-muted-foreground">{done}/{students.length} signatures</span>
          <Button size="sm" variant="ghost" onClick={load}>Actualiser</Button>
        </div>
        {done === students.length && students.length > 0 && <p className="text-sm text-green-700 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Tous les apprenants ont signé. Merci !</p>}
        <ul className="divide-y rounded-md border">
          {students.map((s, i) => (
            <li key={s.k} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
              <span className="flex-1 min-w-0 truncate font-medium">{s.nom} {s.pre}</span>
              {s.signed && <CheckCircle2 className="h-4 w-4 text-green-700" aria-label="A signé" />}
              <Button size="sm" variant={s.signed ? "outline" : "default"} onClick={() => setPad({ i, chain: false })}>{s.signed ? "Refaire" : "Signer"}</Button>
            </li>
          ))}
        </ul>
      </div>
      {pad && (() => {
        const s = students[pad.i];
        const next = () => { const j = nextUnsigned(pad.i); if (pad.chain && j >= 0) setPad({ i: j, chain: true }); else { setPad(null); if (pad.chain) toast.success("Tous les apprenants ont signé."); } };
        return <SignaturePad key={s.k} title={`${s.nom} ${s.pre}`} hint={pad.chain ? `Apprenant ${pad.i + 1} sur ${students.length}` : "Signature de l'apprenant"}
          saveLabel={pad.chain ? "Valider et suivant" : "Valider la signature"} onSkip={pad.chain ? next : undefined}
          onSave={async b => {
            try { await submitSignature(token, s.k, b); markSigned(s.k); next(); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Envoi impossible : réessayez."); throw e; }
          }} onClose={() => setPad(null)} />;
      })()}
    </div>
  );
}
