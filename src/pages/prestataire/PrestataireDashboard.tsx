import { useEffect, useState } from "react";
import { Building2, CreditCard, Plus, Trash2, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AppShell, { type ShellSection } from "@/components/AppShell";
import PageBanner from "@/components/portal/PageBanner";
import Cm2Tools from "@/components/school/Cm2Tools";
import { clearAssets, clearPhotos, clearRoster } from "@/lib/photo-library";
import { useSchoolYear } from "@/contexts/SchoolYearContext";

interface PSchool { id: string; name: string }
const listKey = (uid: string) => `gestionsco.prestataire.schools.${uid}`;
const loadSchools = (uid: string): PSchool[] => { try { return JSON.parse(localStorage.getItem(listKey(uid)) || "[]"); } catch { return []; } };
const saveSchools = (uid: string, s: PSchool[]) => { try { localStorage.setItem(listKey(uid), JSON.stringify(s)); } catch { /* ignore */ } };

const sections: ShellSection[] = [
  { label: "Mes écoles", items: [{ value: "ecoles", label: "Mes écoles", icon: Building2 }] },
  { label: "Travail", items: [{ value: "travail", label: "Fiches, cartes et photos", icon: CreditCard }] },
  { label: "Mon espace", items: [{ value: "compte", label: "Mon compte", icon: UserCircle }] },
];

/** Compte prestataire : ajoute d'abord ses écoles, puis fait pour chacune fiche scolaire, carte scolaire,
    fiche d'inscription et renommage des photos. Les photos de chaque école sont gardées pour la suite. */
export default function PrestataireDashboard() {
  const { user, profile } = useAuth();
  const { year } = useSchoolYear();
  const uid = user?.id ?? "";
  const [active, setActive] = useState("ecoles");
  const [schools, setSchools] = useState<PSchool[]>([]);
  const [current, setCurrent] = useState("");
  const [name, setName] = useState("");
  useEffect(() => { if (uid) { const s = loadSchools(uid); setSchools(s); setCurrent(c => c || (localStorage.getItem(listKey(uid) + ".cur") ?? "") || s[0]?.id || ""); } }, [uid]);
  const choose = (id: string) => { setCurrent(id); try { localStorage.setItem(listKey(uid) + ".cur", id); } catch { /* ignore */ } };

  const add = () => {
    const n = name.trim();
    if (!n) { toast.error("Écrivez le nom de l'école."); return; }
    if (schools.some(s => s.name.toLowerCase() === n.toLowerCase())) { toast.error("Cette école existe déjà."); return; }
    const s = { id: crypto.randomUUID(), name: n };
    const next = [...schools, s]; setSchools(next); saveSchools(uid, next); setName(""); choose(s.id);
    toast.success("École ajoutée. Vous pouvez maintenant travailler dessus.");
    setActive("travail");
  };
  const remove = async (s: PSchool) => {
    if (!window.confirm(`Retirer « ${s.name} » ? Ses photos et sa liste mémorisées sur cet appareil seront effacées.`)) return;
    const scope = `prest:${uid}:${s.id}`;
    await clearPhotos(scope); await clearAssets(scope); await clearRoster(scope, year);
    const next = schools.filter(x => x.id !== s.id); setSchools(next); saveSchools(uid, next);
    if (current === s.id) choose(next[0]?.id ?? "");
  };

  const item = sections.flatMap(x => x.items).find(i => i.value === active);
  const cur = schools.find(s => s.id === current);
  const label = profile?.display_name || profile?.identifier || "Prestataire";

  return (
    <AppShell title="GestionSco" subtitle={`Prestataire : ${label}`} sections={sections} active={active} onSelect={setActive}>
      <PageBanner title={item?.label || "Prestataire"} description="Préparez les fiches scolaires, cartes scolaires, fiches d'inscription et photos des écoles." icon={item?.icon} />
      <Card><CardContent className="p-4 sm:p-6 space-y-6">
        {active === "ecoles" && (
          <div className="space-y-5">
            <div className="space-y-2 max-w-xl">
              <Label>Ajouter une école</Label>
              <div className="flex gap-2">
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nom de l'école, ex. EPP Bantè Centre" onKeyDown={e => e.key === "Enter" && add()} />
                <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
              </div>
              <p className="text-xs text-muted-foreground">On ajoute d'abord l'école ; ensuite chaque photo renommée pour elle est gardée et resservira seule pour la fiche d'inscription et la carte.</p>
            </div>
            {schools.length === 0 ? <p className="text-sm text-muted-foreground">Aucune école pour le moment.</p> : (
              <ul className="divide-y rounded-md border max-w-xl">
                {schools.map(s => (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1 font-medium">{s.name}{s.id === current && <span className="ml-2 text-xs text-primary">en cours</span>}</span>
                    <Button size="sm" variant="outline" onClick={() => { choose(s.id); setActive("travail"); }}>Travailler</Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(s)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">Les écoles, listes et photos sont gardées sur cet appareil. Dans l'onglet « Photos », le bouton « Sauvegarder (ZIP) » permet de les emporter ou de les copier sur un autre appareil.</p>
          </div>
        )}

        {active === "travail" && (
          cur ? (
            <div className="space-y-4">
              <div className="space-y-1 max-w-md">
                <Label>École concernée</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={current} onChange={e => choose(e.target.value)}>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <Cm2Tools key={cur.id} scopeKey={`prest:${uid}:${cur.id}`} schoolName={cur.name} />
            </div>
          ) : (
            <div className="text-center py-10 space-y-3 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto" />
              <p>Ajoutez d'abord une école pour commencer.</p>
              <Button onClick={() => setActive("ecoles")}>Ajouter une école</Button>
            </div>
          )
        )}

        {active === "compte" && <p className="text-sm text-muted-foreground">Compte prestataire : {label}</p>}
      </CardContent></Card>
    </AppShell>
  );
}
