import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, PenLine, PieChart, Trophy, UserCircle, Users } from "lucide-react";
import AppShell, { type ShellSection } from "@/components/AppShell";
import PageBanner from "@/components/portal/PageBanner";
import CandidatesList from "@/components/CandidatesList";
import NotesGrid from "@/components/NotesGrid";
import ResultsTable from "@/components/ResultsTable";
import CenterStats from "@/components/CenterStats";
import ExamStats from "@/components/ExamStats";
import { useAppSettings } from "@/hooks/use-app-settings";

const sections: ShellSection[] = [
  { label: "Examens", items: [{ value: "candidats", label: "Candidats", icon: Users }, { value: "notes", label: "Saisie des notes", icon: PenLine }] },
  { label: "Résultats & analyse", items: [{ value: "resultats", label: "Résultats", icon: Trophy }, { value: "stat-centre", label: "Stat. centre", icon: BarChart3 }, { value: "stat-examen", label: "Synthèse examen", icon: PieChart }] },
  { label: "Mon espace", items: [{ value: "compte", label: "Mon compte", icon: UserCircle }] },
];

export default function CenterDashboard() {
  const { profile, user } = useAuth();
  const { settings } = useAppSettings();
  const [active, setActive] = useState("candidats");
  const center = profile?.display_name || profile?.identifier || "Centre";
  const item = sections.flatMap(section => section.items).find(entry => entry.value === active);
  const renderContent = () => {
    if (active === "candidats") return <CandidatesList centerId={user?.id} canMarkAbsent={settings.centers_can_mark_absent} canEdit={settings.centers_can_edit_candidates} />;
    if (active === "notes") return !settings.centers_can_edit_notes ? <p className="text-sm text-muted-foreground">La saisie des notes est temporairement désactivée par l'administrateur.</p> : user ? <NotesGrid centerId={user.id} /> : null;
    if (active === "resultats") return <ResultsTable centerId={user?.id} />;
    if (active === "stat-centre") return <CenterStats centerId={user?.id} centers={user ? [{ id: user.id, identifier: profile?.identifier || "", display_name: profile?.display_name || undefined }] : undefined} />;
    if (active === "stat-examen") return <ExamStats centerId={user?.id} centers={user ? [{ id: user.id, identifier: profile?.identifier || "", display_name: profile?.display_name || undefined }] : undefined} />;
    return <div className="text-sm text-muted-foreground">Compte : {center}</div>;
  };
  return <AppShell title="GestionSco" subtitle={`Centre : ${center}`} sections={sections} active={active} onSelect={setActive}><PageBanner title={item?.label || "Tableau de bord"} description="Consultez et gérez les données de votre centre d'examen." icon={item?.icon} /><Card><CardContent className="p-4 sm:p-6">{renderContent()}</CardContent></Card></AppShell>;
}