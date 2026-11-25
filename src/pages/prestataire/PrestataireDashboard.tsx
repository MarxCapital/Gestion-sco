import { useEffect, useState } from "react";
import { Building2, CreditCard, FileText, Image as ImageIcon, LayoutDashboard, Plus, Trash2, UserCircle, ClipboardList } from "lucide-react";
import DashboardHome, { type HomeGroup, type HomeStat, type Tone } from "@/components/portal/DashboardHome";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AppShell, { type ShellSection } from "@/components/AppShell";
import PageBanner from "@/components/portal/PageBanner";
import Cm2Tools from "@/components/school/Cm2Tools";
import { allPhotos, clearAssets, clearPhotos, clearRosterScope, rosterCount } from "@/lib/photo-library";
import { useSchoolYear } from "@/contexts/SchoolYearContext";

interface PSchool { id: string; name: string }
const listKey = (uid: string) => `gestionsco.prestataire.schools.${uid}`;
const loadSchools = (uid: string): PSchool[] => { try { return JSON.parse(localStorage.getItem(listKey(uid)) || "[]"); } catch { return []; } };
const saveSchools = (uid: string, s: PSchool[]) => { try { localStorage.setItem(listKey(uid), JSON.stringify(s)); } catch { /* ignore */ } };

const sections: ShellSection[] = [
  { label: "Accueil", items: [{ value: "accueil", label: "Tableau de bord", icon: LayoutDashboard }] },
  { label: "Mes écoles", items: [{ value: "ecoles", label: "Mes écoles", icon: Building2 }] },
  {
    label: "Travail",
    items: [
      { value: "fiche", label: "Fiche scolaire", icon: FileText },
      { value: "photos", label: "Renommer photos", icon: ImageIcon },
      { value: "inscription", label: "Fiche d'inscription CEP", icon: ClipboardList },
      { value: "carte", label: "Carte scolaire", icon: CreditCard },
    ],
  },
  { label: "Mon espace", items: [{ value: "compte", label: "Mon compte", icon: UserCircle }] },
];

const INFO: Record<string, { d: string; tone: Tone }> = {
  ecoles: { d: "Ajoutez les écoles dont vous préparez les dossiers.", tone: "blue" },
  fiche: { d: "Fiches scolaires des apprenants, recto-verso, prêtes à imprimer.", tone: "green" },
  photos: { d: "Renommez les photos dans l'ordre : matricule_nom_prénoms.", tone: "amber" },
  inscription: { d: "Fiches d'inscription au CEP, une par apprenant.", tone: "violet" },
  carte: { d: "Cartes scolaires avec signature électronique et cachet.", tone: "rose" },
  compte: { d: "Votre compte prestataire.", tone: "teal" },
};

/** Compte prestataire : ajoute d'abord ses écoles, puis fait pour chacune fiche scolaire, carte scolaire,
    fiche d'inscription et renommage des photos. Les photos de chaque école sont gardées pour la suite. */
export default function PrestataireDashboard() {
  const { user, profile } = useAuth();
  const { year } = useSchoolYear();
  const uid = user?.id ?? "";
  const [active, setActive] = useState("accueil");
  const TAB_OF: Record<string, string> = { fiche: "fiche", photos: "photos", inscription: "individuelle", carte: "carte" };
  const isWork = active in TAB_OF;
  const [schools, setSchools] = useState<PSchool[]>([]);
  const [current, setCurrent] = useState("");
  const [name, setName] = useState("");
  useEffect(() => { if (uid) { const s = loadSchools(uid); setSchools(s); setCurrent(c => c || (localStorage.getItem(listKey(uid) + ".cur") ?? "") || s[0]?.id || ""); } }, [uid]);
  // Ce qui est mémorisé sur cet appareil pour chaque école (liste et photos)
  const [stock, setStock] = useState<Record<string, { list: number; photos: number }>>({});
  const refreshStock = async (list = schools) => {
    const next: Record<string, { list: number; photos: number }> = {};
    for (const s of list) { const scope = `prest:${uid}:${s.id}`; next[s.id] = { list: await rosterCount(scope), photos: (await allPhotos(scope)).length }; }
    setStock(next);
  };
  useEffect(() => { if (uid) void refreshStock(); }, [uid, schools, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const dropList = async (s: PSchool) => {
    if (!window.confirm(`Supprimer la liste importée pour « ${s.name} » ? Les photos sont conservées.`)) return;
    await clearRosterScope(`prest:${uid}:${s.id}`); toast.success("Liste supprimée."); void refreshStock();
  };
  const dropPhotos = async (s: PSchool) => {
    if (!window.confirm(`Supprimer toutes les photos mémorisées pour « ${s.name} » ? La liste est conservée.`)) return;
    const scope = `prest:${uid}:${s.id}`; await clearPhotos(scope); await clearAssets(scope); toast.success("Photos supprimées."); void refreshStock();
  };
  const choose = (id: string) => { setCurrent(id); try { localStorage.setItem(listKey(uid) + ".cur", id); } catch { /* ignore */ } };

  const add = () => {
    const n = name.trim();
    if (!n) { toast.error("Écrivez le nom de l'école."); return; }
    if (schools.some(s => s.name.toLowerCase() === n.toLowerCase())) { toast.error("Cette école existe déjà."); return; }
    const s = { id: crypto.randomUUID(), name: n };
    const next = [...schools, s]; setSchools(next); saveSchools(uid, next); setName(""); choose(s.id);
    toast.success("École ajoutée. Vous pouvez maintenant travailler dessus.");
    setActive("photos");
  };
  const remove = async (s: PSchool) => {
    if (!window.confirm(`Retirer « ${s.name} » ? Ses photos et sa liste mémorisées sur cet appareil seront effacées.`)) return;
    const scope = `prest:${uid}:${s.id}`;
    await clearPhotos(scope); await clearAssets(scope); await clearRosterScope(scope);
    const next = schools.filter(x => x.id !== s.id); setSchools(next); saveSchools(uid, next);
    if (current === s.id) choose(next[0]?.id ?? "");
  };

  const groups: HomeGroup[] = sections.filter(sec => sec.label !== "Accueil").map(sec => ({
    title: sec.label,
    tiles: sec.items.map(i => ({ value: i.value, label: i.label, icon: i.icon, description: INFO[i.value]?.d ?? "", tone: INFO[i.value]?.tone ?? "blue", badge: i.value === "ecoles" && schools.length === 0 ? "Commencer" : undefined })),
  }));
  const stats: HomeStat[] = [
    { icon: Building2, value: schools.length, label: "Écoles", tone: "blue" },
    ...(schools.length ? [{ icon: ClipboardList, value: schools.find(x => x.id === current)?.name ?? "—", label: "École en cours", tone: "green" as Tone }] : []),
  ];

  const item = sections.flatMap(x => x.items).find(i => i.value === active);
  const cur = schools.find(s => s.id === current);
  const label = profile?.display_name || profile?.identifier || "Prestataire";

  return (
    <AppShell title="GestionSco" subtitle={`Prestataire : ${label}`} sections={sections} active={active} onSelect={setActive}>
      {active === "accueil" && (
        <DashboardHome name={label} subtitle="Préparez les fiches scolaires, photos, fiches d'inscription et cartes scolaires de chaque école, en toute simplicité." stats={stats} groups={groups} onSelect={setActive}
          tip="Ajoutez d'abord une école : ses photos et sa liste sont gardées sur cet appareil et resservent pour la fiche d'inscription et la carte." />
      )}
      {active !== "accueil" && <PageBanner title={item?.label || "Prestataire"} description="Préparez les fiches scolaires, cartes scolaires, fiches d'inscription et photos des écoles." icon={item?.icon} />}
      {active !== "accueil" && <Card><CardContent className="p-4 sm:p-6 space-y-6">
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
                  <li key={s.id} className="space-y-2 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-medium">{s.name}{s.id === current && <span className="ml-2 text-xs text-primary">en cours</span>}</span>
                      <Button size="sm" variant="outline" onClick={() => { choose(s.id); setActive("photos"); }}>Travailler</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Supprimer l'école" onClick={() => remove(s)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{stock[s.id] ? `${stock[s.id].list} apprenant(s) · ${stock[s.id].photos} photo(s) mémorisés` : "…"}</span>
                      {!!stock[s.id]?.list && <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => dropList(s)}>Supprimer la liste</Button>}
                      {!!stock[s.id]?.photos && <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => dropPhotos(s)}>Supprimer les photos</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">Les écoles, listes et photos sont gardées sur cet appareil. Dans l'onglet « Photos », le bouton « Sauvegarder (ZIP) » permet de les emporter ou de les copier sur un autre appareil.</p>
          </div>
        )}

        {isWork && (
          cur ? (
            <div className="space-y-4">
              <div className="space-y-1 max-w-md">
                <Label>École concernée</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={current} onChange={e => choose(e.target.value)}>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <Cm2Tools key={cur.id} scopeKey={`prest:${uid}:${cur.id}`} schoolName={cur.name} forcedTab={TAB_OF[active]} />
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
      </CardContent></Card>}
    </AppShell>
  );
}
