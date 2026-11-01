import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Download, PenLine, PieChart, Trophy, UserCircle, Users } from "lucide-react";
import AppShell, { type ShellSection } from "@/components/AppShell";
import PageBanner from "@/components/portal/PageBanner";
import CandidatesList from "@/components/CandidatesList";
import NotesGrid from "@/components/NotesGrid";
import ResultsTable from "@/components/ResultsTable";
import CenterStats from "@/components/CenterStats";
import ExamStats from "@/components/ExamStats";
import { useAppSettings } from "@/hooks/use-app-settings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sortByOrder } from "@/lib/calculations";
import { generateCandidatesPdf } from "@/lib/pdf-utils";
import { getSchoolYear } from "@/lib/school-year";

const sections: ShellSection[] = [
  { label: "Examens", items: [{ value: "candidats", label: "Candidats", icon: Users }, { value: "notes", label: "Saisie des notes", icon: PenLine }] },
  { label: "Résultats & analyse", items: [{ value: "resultats", label: "Résultats", icon: Trophy }, { value: "stat-centre", label: "Stat. centre", icon: BarChart3 }, { value: "stat-examen", label: "Synthèse examen", icon: PieChart }] },
  { label: "Mon espace", items: [{ value: "compte", label: "Mon compte", icon: UserCircle }] },
];

export default function IndependentDashboard() {
  const { profile, user } = useAuth();
  const { settings } = useAppSettings();
  const [active, setActive] = useState("candidats");
  const centerName = profile?.display_name || profile?.identifier || "Centre indépendant";
  const item = sections.flatMap(section => section.items).find(entry => entry.value === active);
  const downloadCandidates = async () => { if (!user?.id) return; const { data, error } = await supabase.from("candidates").select("numero_table, nom, prenoms, sexe, ecole_provenance, is_absent, sort_order").eq("school_year", getSchoolYear()).eq("center_id", user.id).order("sort_order", { ascending: true }); if (error || !data) { toast.error("Erreur lors du chargement des candidats"); return; } const sorted = sortByOrder(data as any); generateCandidatesPdf(sorted, { documentTitle: `Liste des candidats - ${centerName}`, centerName, effectif: sorted.length, signatureRole: "center" }); toast.success("Liste téléchargée"); };
  const content = active === "candidats" ? <><div className="mb-4 flex justify-end"><Button variant="outline" size="sm" onClick={downloadCandidates}><Download />Télécharger la liste</Button></div><CandidatesList centerId={user?.id} canMarkAbsent={settings.centers_can_mark_absent} canEdit={settings.centers_can_edit_candidates} /></> : active === "notes" ? (!settings.centers_can_edit_notes ? <p className="text-sm text-muted-foreground">La saisie des notes est temporairement désactivée par l'administrateur.</p> : user ? <NotesGrid centerId={user.id} /> : null) : active === "resultats" ? <ResultsTable centerId={user?.id} /> : active === "stat-centre" ? <CenterStats centerId={user?.id} centers={user ? [{ id: user.id, identifier: profile?.identifier || "", display_name: profile?.display_name || undefined }] : undefined} /> : active === "stat-examen" ? <ExamStats centerId={user?.id} centers={user ? [{ id: user.id, identifier: profile?.identifier || "", display_name: profile?.display_name || undefined }] : undefined} /> : <p className="text-sm text-muted-foreground">Compte : {centerName}</p>;
  return <AppShell title="GestionSco" subtitle={`Centre indépendant : ${centerName}`} sections={sections} active={active} onSelect={setActive}><PageBanner title={item?.label || "Tableau de bord"} description="Gérez vos candidats et consultez leurs résultats." icon={item?.icon} /><Card><CardContent className="p-4 sm:p-6">{content}</CardContent></Card></AppShell>;
}