import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCeg, loadCegs, normCeg, removeCeg, searchCegs } from "@/lib/ceg-bante";

/** Choix de 3 établissements par ordre de préférence, avec barre de recherche. */
export default function CegPicker({ value, onChange }: { value: [string, string, string]; onChange: (v: [string, string, string]) => void }) {
  const [list, setList] = useState<string[]>(() => loadCegs());
  const [q, setQ] = useState("");
  const [extra, setExtra] = useState("");
  const shown = useMemo(() => searchCegs(list, q), [list, q]);
  const rank = (c: string) => value.findIndex(v => v && normCeg(v) === normCeg(c));

  const toggle = (c: string) => {
    const r = rank(c);
    const next = [...value] as [string, string, string];
    if (r >= 0) next[r] = "";
    else { const free = next.findIndex(v => !v); if (free < 0) return; next[free] = c; }
    onChange(next);
  };
  const full = value.every(Boolean);
  const add = () => { const n = extra.trim(); if (!n) return; setList(addCeg(n)); setExtra(""); setQ(""); if (!value.some(v => normCeg(v) === normCeg(n))) { const free = value.findIndex(v => !v); if (free >= 0) { const next = [...value] as [string, string, string]; next[free] = n; onChange(next); } } };

  return (
    <div className="space-y-2">
      <div className="grid gap-1.5 sm:grid-cols-3">
        {value.map((v, i) => (
          <div key={i} className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-sm min-h-9 ${v ? "bg-primary/5 border-primary/40" : "text-muted-foreground"}`}>
            <span className="font-semibold">{i + 1}-</span><span className="flex-1 truncate">{v || "à choisir"}</span>
            {v && <button type="button" aria-label="Retirer" onClick={() => { const n = [...value] as [string, string, string]; n[i] = ""; onChange(n); }}><X className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
      </div>
      <div className="relative">
        <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input className="h-9 pl-8" placeholder="Rechercher un collège (ex. Gouka, Pira…)" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="max-h-52 overflow-auto rounded-md border divide-y">
        {shown.length === 0 && <p className="p-3 text-sm text-muted-foreground">Aucun collège trouvé : ajoutez-le ci-dessous.</p>}
        {shown.map(c => {
          const r = rank(c);
          return (
            <div key={c} className="flex items-center">
              <button type="button" disabled={r < 0 && full} onClick={() => toggle(c)} className={`flex-1 flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50 ${r >= 0 ? "bg-primary/10 font-medium" : ""}`}>
                <span className={`h-5 w-5 shrink-0 rounded-full grid place-items-center text-[11px] border ${r >= 0 ? "bg-primary text-primary-foreground border-primary" : ""}`}>{r >= 0 ? r + 1 : ""}</span>{c}
              </button>
              <button type="button" title="Retirer ce collège de la liste" className="px-2 text-muted-foreground hover:text-destructive" onClick={() => { if (window.confirm(`Retirer « ${c} » de la liste proposée ?`)) setList(removeCeg(c)); }}><X className="h-3.5 w-3.5" /></button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input className="h-9" placeholder="Un collège absent de la liste ? Écrivez son nom" value={extra} onChange={e => setExtra(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
      </div>
    </div>
  );
}
