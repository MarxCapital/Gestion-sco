import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileText, GraduationCap, BarChart3, CalendarCheck, LayoutDashboard, PenLine, PieChart, Trophy, UserCircle, Users } from "lucide-react";
import SchoolHome from "@/components/school/SchoolHome";
import type { HomeGroup, Tone } from "@/components/portal/DashboardHome";
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
  { label: "Accueil", items: [{ value: "accueil", label: "Tableau de bord", icon: LayoutDashboard }] },
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

const INFO: Record<string, { d: string; tone: Tone }> = {
  eleves: { d: "Importez et gérez la liste de votre classe.", tone: "blue" },
  presence: { d: "Faites l'appel du matin et du soir en quelques secondes.", tone: "green" },
  notes: { d: "Saisissez les notes sur 20, matière par matière ou élève par élève.", tone: "amber" },
  resultats: { d: "Classements et moyennes de la classe, prêts à télécharger.", tone: "violet" },
  "stat-evaluation": { d: "Pourcentage de réussite par évaluation et par matière.", tone: "rose" },
  "stat-classe": { d: "Présences, absences et assiduité par jour et par mois.", tone: "teal" },
  guides: { d: "Les guides pédagogiques de votre classe.", tone: "indigo" },
  fiches: { d: "Les fiches pédagogiques à consulter ou télécharger.", tone: "green" },
  cm2: { d: "Photos, fiche scolaire, inscription au CEP et carte scolaire.", tone: "rose" },
  profil: { d: "Votre école, votre classe et votre photo.", tone: "violet" },
};

const SchoolDashboard = () => {
  const { profile, user } = useAuth();
  const [active, setActive] = useState("accueil");
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
        { label: "Dossiers CM2", items: [{ value: "cm2", label: "Photos, fiches et inscriptions", icon: GraduationCap }] },
        baseSections[baseSections.length - 1],
      ]
    : baseSections;
  const current = !isCm2 && active === "cm2" ? "accueil" : active;

  const groups: HomeGroup[] = sections.filter(sec => sec.label !== "Accueil").map(sec => ({
    title: sec.label,
    tiles: sec.items.map(i => ({ value: i.value, label: i.label, icon: i.icon, description: INFO[i.value]?.d ?? "", tone: INFO[i.value]?.tone ?? "blue" })),
  }));
  const who = p?.teacher_name || profile?.display_name || profile?.identifier || "bienvenue";

  const title = sections.flatMap(s => s.items).find(i => i.value === current)?.label ?? "";

  const content = () => {
    if (!schoolId) return null;
    switch (current) {
      case "accueil": return <SchoolHome schoolId={schoolId} name={who} schoolLabel={schoolLabel} groups={groups} onSelect={setActive} />;
      case "eleves": return <StudentsList schoolId={schoolId} schoolLabel={schoolLabel} />;
      case "presence": return <AttendanceToday schoolId={schoolId} />;
      case "notes": return <SchoolNotes schoolId={schoolId} schoolLabel={schoolLabel} />;
      case "resultats": return <SchoolResults schoolId={schoolId} schoolLabel={schoolLabel} />;
      case "stat-evaluation": return <EvaluationStats schoolId={schoolId} schoolLabel={schoolLabel} />;
      case "stat-classe": return <ClassStats schoolId={schoolId} schoolLabel={schoolLabel} />;
      case "guides": return <ClassResources key="guide" mode="school" kind="guide" profileClass={p?.class_name} onProfile={() => setActive("profil")} />;
      case "fiches": return <ClassResources key="fiche" mode="school" kind="fiche" profileClass={p?.class_name} onProfile={() => setActive("profil")} />;
      case "cm2": return <Cm2Tools schoolName={p?.school_name} schoolId={schoolId} listFromDb />;
      case "profil": return <SchoolProfile schoolId={schoolId} />;
      default: return null;
    }
  };

  return (
    <AppShell title="GestionSco" subtitle={schoolLabel} sections={sections} active={current} onSelect={setActive}>
      {current === "accueil" ? content() : <>
        <PageBanner title={title} description="Gérez les informations de votre école pour l'année sélectionnée." />
        {current === "profil" ? content() : <Card><CardContent className="p-4 sm:p-6">{content()}</CardContent></Card>}
      </>}
    </AppShell>
  );
};

export default SchoolDashboard;
