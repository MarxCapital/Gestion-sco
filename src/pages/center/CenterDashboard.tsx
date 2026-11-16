import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, PenLine, PieChart, Trophy, UserCircle, Users } from "lucide-react";
import { LayoutDashboard } from "lucide-react";
import DashboardHome, { groupsFromSections, type HomeStat, type Tone } from "@/components/portal/DashboardHome";
import { useExamCounts } from "@/hooks/useExamCounts";
import AppShell, { type ShellSection } from "@/components/AppShell";
import PageBanner from "@/components/portal/PageBanner";
import CandidatesList from "@/components/CandidatesList";
import NotesGrid from "@/components/NotesGrid";
import ResultsTable from "@/components/ResultsTable";
import CenterStats from "@/components/CenterStats";
import ExamStats from "@/components/ExamStats";
import { useAppSettings } from "@/hooks/use-app-settings";

const sections: ShellSection[] = [
  { label: "Accueil", items: [{ value: "accueil", label: "Tableau de bord", icon: LayoutDashboard }] },
  { label: "Examens", items: [{ value: "candidats", label: "Candidats", icon: Users }, { value: "notes", label: "Saisie des notes", icon: PenLine }] },
  { label: "Résultats & analyse", items: [{ value: "resultats", label: "Résultats", icon: Trophy }, { value: "stat-centre", label: "Stat. centre", icon: BarChart3 }, { value: "stat-examen", label: "Synthèse examen", icon: PieChart }] },
  { label: "Mon espace", items: [{ value: "compte", label: "Mon compte", icon: UserCircle }] },
];

const INFO: Record<string, { d: string; tone: Tone }> = {
  candidats: { d: "La liste de vos candidats, avec les absents et les corrections.", tone: "blue" },
  notes: { d: "La grille des 9 matières : total, moyenne, seuil et rang se calculent seuls.", tone: "amber" },
  resultats: { d: "Classement, Top 10/20/50 et résultats téléchargeables.", tone: "violet" },
  "stat-centre": { d: "Inscrits, présents, absents et liste nominative des absents.", tone: "teal" },
  "stat-examen": { d: "Réussite par école et par matière, prête à signer.", tone: "rose" },
  compte: { d: "Les informations de votre compte.", tone: "indigo" },
};
export default function CenterDashboard() {
  const { profile, user } = useAuth();
  const { settings } = useAppSettings();
  const [active, setActive] = useState("accueil");
  const center = profile?.display_name || profile?.identifier || "Centre";
  const item = sections.flatMap(section => section.items).find(entry => entry.value === active);
  const counts = useExamCounts(user?.id);
  const stats: HomeStat[] | undefined = counts ? [
    { icon: Users, value: counts.total, label: "Candidats", tone: "blue" },
    { icon: Users, value: counts.garcons, label: "Garçons", tone: "indigo" },
    { icon: Users, value: counts.filles, label: "Filles", tone: "rose" },
    { icon: UserCircle, value: counts.absents, label: "Absents", tone: counts.absents ? "amber" : "green" },
  ] : undefined;
  const renderContent = () => {
    if (active === "accueil") return <DashboardHome name={center} subtitle="Votre centre d'examen : de la liste des candidats au classement, tout est ici." stats={stats} groups={groupsFromSections(sections, INFO)} onSelect={setActive} tip="Les notes sont enregistrées au fur et à mesure, même sans réseau : elles partent toutes seules dès que la connexion revient." />;
    if (active === "candidats") return <CandidatesList centerId={user?.id} canMarkAbsent={settings.centers_can_mark_absent} canEdit={settings.centers_can_edit_candidates} />;
    if (active === "notes") return !settings.centers_can_edit_notes ? <p className="text-sm text-muted-foreground">La saisie des notes est temporairement désactivée par l'administrateur.</p> : user ? <NotesGrid centerId={user.id} /> : null;
    if (active === "resultats") return <ResultsTable centerId={user?.id} />;
    if (active === "stat-centre") return <CenterStats centerId={user?.id} centers={user ? [{ id: user.id, identifier: profile?.identifier || "", display_name: profile?.display_name || undefined }] : undefined} />;
    if (active === "stat-examen") return <ExamStats centerId={user?.id} centers={user ? [{ id: user.id, identifier: profile?.identifier || "", display_name: profile?.display_name || undefined }] : undefined} />;
    return <div className="text-sm text-muted-foreground">Compte : {center}</div>;
  };
  return <AppShell title="GestionSco" subtitle={`Centre : ${center}`} sections={sections} active={active} onSelect={setActive}>{active === "accueil" ? renderContent() : <><PageBanner title={item?.label || "Tableau de bord"} description="Consultez et gérez les données de votre centre d'examen." icon={item?.icon} /><Card><CardContent className="p-4 sm:p-6">{renderContent()}</CardContent></Card></>}</AppShell>;
}