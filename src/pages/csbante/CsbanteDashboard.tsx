import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, PieChart, Trophy, UserCircle, Users } from "lucide-react";
import AppShell, { type ShellSection } from "@/components/AppShell";
import PageBanner from "@/components/portal/PageBanner";
import CandidatesList from "@/components/CandidatesList";
import ResultsTable from "@/components/ResultsTable";
import CenterStats from "@/components/CenterStats";
import ExamStats from "@/components/ExamStats";
import { useAppSettings } from "@/hooks/use-app-settings";

const sections: ShellSection[] = [
  { label: "Examens", items: [{ value: "candidats", label: "Candidats", icon: Users }] },
  { label: "Résultats & analyse", items: [{ value: "resultats", label: "Résultats", icon: Trophy }, { value: "stat-centre", label: "Stat. centres", icon: BarChart3 }, { value: "stat-examen", label: "Synthèse examen", icon: PieChart }] },
  { label: "Mon espace", items: [{ value: "compte", label: "Mon compte", icon: UserCircle }] },
];

export default function CsbanteDashboard() {
  const { profile } = useAuth();
  const { settings } = useAppSettings();
  const [active, setActive] = useState("candidats");
  const [centers, setCenters] = useState<{ id: string; identifier: string; display_name?: string }[]>([]);
  useEffect(() => { const load = async () => { const [{ data: profiles }, { data: roles }] = await Promise.all([supabase.from("profiles").select("id, identifier, display_name").neq("identifier", "Marx"), supabase.from("user_roles").select("user_id, role")]); setCenters(((profiles as any) || []).filter((p: any) => ((roles as any) || []).some((r: any) => r.user_id === p.id && r.role === "center"))); }; load(); }, []);
  const item = sections.flatMap(section => section.items).find(entry => entry.value === active);
  const content = active === "candidats" ? <CandidatesList requireFilter canEdit={settings.csbante_can_edit_candidates} centers={centers} /> : active === "resultats" ? <ResultsTable requireFilter centers={centers} /> : active === "stat-centre" ? <CenterStats centers={centers} /> : active === "stat-examen" ? <ExamStats requireFilter centers={centers} filterMode="subject" /> : <p className="text-sm text-muted-foreground">{profile?.display_name || "Circonscription Scolaire de Bantè"}</p>;
  return <AppShell title="GestionSco" subtitle="Circonscription Scolaire de Bantè" sections={sections} active={active} onSelect={setActive}><PageBanner title={item?.label || "Tableau de bord"} description="Vue consolidée des centres de la circonscription." icon={item?.icon} /><Card><CardContent className="p-4 sm:p-6">{content}</CardContent></Card></AppShell>;
}