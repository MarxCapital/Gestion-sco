import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileText, GraduationCap, BarChart3, CalendarCheck, PenLine, PieChart, Trophy, UserCircle, Users } from "lucide-react";
import AppShell, { type ShellSection } from "@/components/AppShell";
import StudentsList from "@/components/school/StudentsList";
import AttendanceToday from "@/components/school/AttendanceToday";
import SchoolNotes from "@/components/school/SchoolNotes";
import SchoolResults from "@/components/school/SchoolResults";
import EvaluationStats from "@/components/school/EvaluationStats";
import ClassStats from "@/components/school/ClassStats";
import SchoolProfile from "@/components/school/SchoolProfile";
import ClassResources from "@/components/ClassResources";
import Cm2Tools from "@/components/school/Cm2Tools";
import { normalizeResourceClass } from "@/lib/class-resource-rules";
import PageBanner from "@/components/portal/PageBanner";

const baseSections: ShellSection[] = [
  {
    label: "Élèves",
    items: [
      { value: "eleves", label: "Élèves", icon: Users },
      { value: "presence", label: "Présence du jour", icon: CalendarCheck },
    ],
  },
  {
    label: "Évaluations",
    items: [
      { value: "notes", label: "Saisie des notes", icon: PenLine },
      { value: "resultats", label: "Résultats", icon: Trophy },
      { value: "stat-evaluation", label: "Statistiques de l'évaluation", icon: PieChart },
    ],
  },
  {
    label: "Classe",
    items: [
      { value: "stat-classe", label: "Statistiques de la classe", icon: BarChart3 },
    ],
  },
  {
    label: "Documents pédagogiques",
    items: [
      { value: "guides", label: "Guides", icon: BookOpen },
      { value: "fiches", label: "Fiches", icon: FileText },
    ],
  },
  {
    label: "Compte",
    items: [
      { value: "profil", label: "Mon profil", icon: UserCircle },
    ],
  },
];

const SchoolDashboard = () => {
  const { profile, user } = useAuth();
  const [active, setActive] = useState("eleves");
  const schoolId = user?.id ?? "";
  const p = profile as any;
  const schoolLabel = p?.school_name
    ? `${p.school_name}${p?.class_name ? ` - ${p.class_name}` : ""}`
    : (profile?.display_name || profile?.identifier || "École");

  // Les outils CM2 (photos, fiche scolaire) n'apparaissent que si la classe du profil est CM2.
  const isCm2 = normalizeResourceClass(p?.class_name) === "CM2";
  const sections: ShellSection[] = isCm2
    ? [
        ...baseSections.slice(0, -1),
        { label: "Dossiers CM2", items: [{ value: "cm2", label: "Photos et fiches scolaires", icon: GraduationCap }] },
        baseSections[baseSections.length - 1],
      ]
    : baseSections;
  const current = !isCm2 && active === "cm2" ? "eleves" : active;

  const title = sections.flatMap(s => s.items).find(i => i.value === current)?.label ?? "";

  const content = () => {
    if (!schoolId) return null;
    switch (current) {
      case "eleves": return <StudentsList schoolId={schoolId} schoolLabel={schoolLabel} />;
      case "presence": return <AttendanceToday schoolId={schoolId} />;
      case "notes": return <SchoolNotes schoolId={schoolId} schoolLabel={schoolLabel} />;
      case "resultats": return <SchoolResults schoolId={schoolId} schoolLabel={schoolLabel} />;
      case "stat-evaluation": return <EvaluationStats schoolId={schoolId} schoolLabel={schoolLabel} />;
      case "stat-classe": return <ClassStats schoolId={schoolId} schoolLabel={schoolLabel} />;
      case "guides": return <ClassResources key="guide" mode="school" kind="guide" profileClass={p?.class_name} onProfile={() => setActive("profil")} />;
      case "fiches": return <ClassResources key="fiche" mode="school" kind="fiche" profileClass={p?.class_name} onProfile={() => setActive("profil")} />;
      case "cm2": return <Cm2Tools schoolName={p?.school_name} />;
      case "profil": return <SchoolProfile schoolId={schoolId} />;
      default: return null;
    }
  };

  return (
    <AppShell title="GestionSco" subtitle={schoolLabel} sections={sections} active={current} onSelect={setActive}>
      <PageBanner title={title} description="Gérez les informations de votre école pour l'année sélectionnée." />
      {current === "profil" ? content() : <Card><CardContent className="p-4 sm:p-6">{content()}</CardContent></Card>}
    </AppShell>
  );
};

export default SchoolDashboard;
