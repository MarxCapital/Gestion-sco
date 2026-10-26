import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  HelpCircle,
  Landmark,
  LogIn,
  Menu,
  MonitorSmartphone,
  Shield,
  School,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import InstallBanner from "@/components/InstallBanner";
import TricolorBar from "@/components/portal/TricolorBar";
import logoImg from "@/assets/brand";

// Images du héro : fichiers légers (WebP, ~50-100 Ko) dans /public, préchargés dès l'ouverture
// de la page (voir index.html) pour s'afficher sans attendre le chargement du code de l'application.
const heroImages = ["/hero/hero-1.webp?v=2", "/hero/hero-2.webp?v=2", "/hero/hero-3.webp?v=2"];

const features = [
  {
    icon: Users,
    title: "Candidats aux examens",
    desc: "Importez, organisez et consultez les candidats par centre et école de provenance.",
    tone: "bg-pastel-blue text-primary",
  },
  {
    icon: ClipboardCheck,
    title: "Présences et absences",
    desc: "Suivez les présences des élèves et les absences relevées pendant les évaluations.",
    tone: "bg-pastel-mint text-success",
  },
  {
    icon: FileText,
    title: "Notes et évaluations",
    desc: "Saisissez les notes avec sauvegarde automatique et navigation rapide dans les grilles.",
    tone: "bg-pastel-violet text-primary",
  },
  {
    icon: BarChart3,
    title: "Résultats et statistiques",
    desc: "Analysez les performances par centre, école, matière et sexe, puis téléchargez les rapports.",
    tone: "bg-pastel-yellow text-warning-foreground",
  },
  {
    icon: School,
    title: "Suivi de la classe",
    desc: "L'espace école rassemble élèves, présences, évaluations, résultats et profil enseignant.",
    tone: "bg-pastel-blue text-primary",
  },
  {
    icon: Archive,
    title: "Archives par année",
    desc: "Choisissez l'année scolaire et retrouvez les anciens registres en lecture et téléchargement.",
    tone: "bg-pastel-mint text-success",
  },
];

const spaces = [
  { icon: Building2, title: "Centres d'examen", desc: "Candidats, notes, résultats et statistiques du centre." },
  { icon: School, title: "Écoles", desc: "Élèves, présences, évaluations et suivi pédagogique de la classe." },
  { icon: Landmark, title: "CS Bantè", desc: "Synthèses globales par centre, école et matière." },
  { icon: ShieldCheck, title: "Administration", desc: "Pilotage des comptes, centres et paramètres de la plateforme." },
];

const reminders = [
  { icon: CalendarDays, title: "L'année scolaire est choisie avant chaque opération", border: "border-l-tricolor-red", tone: "bg-pastel-blue text-primary" },
  { icon: WifiOff, title: "Le travail reste disponible même sans connexion internet", border: "border-l-primary", tone: "bg-pastel-mint text-success" },
  { icon: BookOpenCheck, title: "Les résultats, moyennes et rangs sont calculés automatiquement", border: "border-l-tricolor-yellow", tone: "bg-pastel-violet text-primary" },
];

const keyFigures = [
  { value: "4", label: "espaces adaptés", detail: "Centre, École, CS Bantè et Administration" },
  { value: "2", label: "années accessibles", detail: "Registre actif et archives en lecture" },
  { value: "1", label: "portail public", detail: "Consultation directe des résultats" },
];

const steps = [
  { title: "Choisir l'année", desc: "Sélectionnez le registre scolaire avant de commencer toute opération." },
  { title: "Gérer les informations", desc: "Travaillez sur les élèves, candidats, présences et notes depuis votre espace." },
  { title: "Analyser et télécharger", desc: "Consultez les résultats, statistiques et documents prêts à être téléchargés." },
];

const faqs = [
  { question: "À qui GestionSco est-il destiné ?", answer: "Aux centres d'examen, aux écoles, à la CS Bantè et aux administrateurs, avec un espace adapté à chaque responsabilité." },
  { question: "Peut-on consulter les anciennes années ?", answer: "Oui. Le registre 2025-2026 reste disponible en lecture et téléchargement, sans modification." },
  { question: "La plateforme fonctionne-t-elle sans connexion ?", answer: "Les fonctions prévues pour le travail hors ligne restent accessibles et les données sont synchronisées au retour de la connexion." },
  { question: "Comment consulter un résultat ?", answer: "Le portail public de résultats est accessible depuis le bouton « Consulter un résultat », sans entrer dans un espace de gestion." },
];

export default function Index() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (user && role) {
      navigate(({
        admin: "/admin",
        center: "/centre",
        csbante: "/csbante",
        independent: "/independant",
        school: "/ecole",
        prestataire: "/prestataire",
      } as Record<string, string>)[role] || "/login", { replace: true });
    }
  }, [user, role, navigate]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setCurrentSlide((slide) => (slide + 1) % heroImages.length),
      5500,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-home-body">
      <InstallBanner persistent />

      <header className="relative min-h-[650px] overflow-hidden bg-sidebar text-primary-foreground sm:min-h-[720px]">
        <div className="absolute inset-0" aria-hidden="true">
          {heroImages.map((image, index) => (
            <img
              key={image}
              src={image}
              alt=""
              width={1600}
              height={1000}
              loading="eager"
              decoding="async"
              {...({ fetchpriority: index === 0 ? "high" : "auto" } as Record<string, string>)}
              className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 motion-reduce:transition-none ${currentSlide === index ? "opacity-100" : "opacity-0"}`}
            />
          ))}
          <div className="absolute inset-0 bg-primary/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-sidebar/90 via-sidebar/15 to-sidebar/5" />
        </div>

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between border-b border-primary-foreground/15 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center bg-card p-1 shadow-soft">
              <img src={logoImg} alt="GestionSco" className="h-full w-full object-contain" />
            </span>
            <div>
              <p className="font-home-heading text-lg font-bold leading-tight">GestionSco</p>
              <p className="hidden text-[10px] uppercase text-primary-foreground/70 sm:block">Plateforme de gestion scolaire</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-5 text-xs font-semibold md:flex">
              <a href="#fonctionnalites" className="transition-opacity hover:opacity-75">Fonctionnalités</a>
              <a href="#fonctionnement" className="transition-opacity hover:opacity-75">Fonctionnement</a>
              <a href="#securite" className="transition-opacity hover:opacity-75">Sécurité</a>
              <a href="#faq" className="transition-opacity hover:opacity-75">FAQ</a>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate("/login")} className="border border-primary bg-card text-primary hover:bg-secondary">
              <LogIn />Connexion
            </Button>
            <Menu className="h-5 w-5 md:hidden" aria-hidden="true" />
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-start px-4 pb-24 pt-24 text-left sm:px-6 sm:pt-28">
          <div className="mb-5 inline-flex items-center gap-2 border border-primary-foreground/30 bg-sidebar/40 px-3 py-2 font-home-heading text-xs font-semibold uppercase backdrop-blur-sm">
            <CalendarDays className="h-4 w-4" /> Année scolaire 2026-2027
          </div>
          <h1 className="max-w-3xl font-home-heading text-3xl font-extrabold leading-tight sm:text-5xl">La gestion scolaire simplifiée, du suivi des élèves aux résultats</h1>
          <TricolorBar className="my-5" />
          <p className="font-home-heading text-base font-bold sm:text-lg">Circonscription Scolaire de Bantè</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/90 sm:text-base">GestionSco réunit écoles, centres d'examen et administration dans un environnement clair pour gérer candidats, présences, notes et statistiques.</p>
          <div className="mt-7 grid w-full max-w-md gap-3 sm:flex sm:w-auto">
            <Button size="lg" onClick={() => navigate("/login")} className="w-full bg-card text-primary shadow-soft hover:bg-secondary sm:w-auto">
              <LogIn />Accéder à mon espace
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/resultats")} className="w-full border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto">
              Consulter un résultat<ChevronRight />
            </Button>
          </div>
          <div className="mt-8 flex gap-2">
            {heroImages.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Afficher la photo ${index + 1}`}
                aria-current={currentSlide === index ? "true" : undefined}
                onClick={() => setCurrentSlide(index)}
                className={`h-1.5 transition-all duration-200 ${currentSlide === index ? "w-9 bg-primary-foreground" : "w-5 bg-primary-foreground/40"}`}
              />
            ))}
          </div>
        </div>

        <svg className="absolute bottom-0 h-12 w-full" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 35c340 42 680-34 1020 0 170 17 300 16 420 0v25H0Z" className="fill-background" />
        </svg>
      </header>

      <main>
        <section className="border-b bg-secondary/55">
          <div className="mx-auto grid max-w-7xl gap-px bg-border sm:grid-cols-3">
            {keyFigures.map(({ value, label, detail }) => (
              <article key={label} className="bg-card px-6 py-7 sm:px-8">
                <div className="font-home-heading text-3xl font-extrabold text-primary">{value}</div>
                <h2 className="mt-1 font-home-heading text-sm font-bold uppercase text-foreground">{label}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="fonctionnalites" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20">
          <div className="text-center">
            <p className="font-heading text-xs font-semibold uppercase text-muted-foreground">Le registre actif</p>
            <h2 className="mt-2 font-home-heading text-2xl font-bold text-primary sm:text-3xl">Tout le suivi scolaire 2026-2027</h2>
            <TricolorBar centered className="my-4" />
            <p className="mx-auto max-w-2xl text-muted-foreground">Chaque profil retrouve les outils adaptés à ses responsabilités, sans changer les habitudes de travail.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc, tone }) => (
              <article key={title} className="group flex min-h-60 flex-col border bg-card p-6 shadow-soft transition-transform duration-200 hover:-translate-y-1 motion-reduce:transform-none">
                <div className={`grid h-12 w-12 place-items-center ${tone}`}><Icon className="h-6 w-6" /></div>
                <h3 className="mt-5 font-home-heading text-lg font-bold">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{desc}</p>
                <div className="mt-5 flex justify-end border-t border-dashed pt-3 text-primary"><ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-sidebar text-sidebar-foreground">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <p className="font-heading text-xs font-semibold uppercase text-sidebar-foreground/65">Un accès adapté à chacun</p>
               <h2 className="mt-2 font-home-heading text-2xl font-bold sm:text-3xl">Pensé pour chaque acteur scolaire</h2>
              <TricolorBar className="my-4" />
              <p className="text-sm leading-6 text-sidebar-foreground/75">Les menus et les informations visibles s'adaptent automatiquement au compte connecté.</p>
            </div>
            <div className="mt-9 grid gap-px border border-sidebar-border bg-sidebar-border sm:grid-cols-2 lg:grid-cols-4">
              {spaces.map(({ icon: Icon, title, desc }) => (
                <article key={title} className="bg-sidebar p-6">
                  <Icon className="h-7 w-7 text-sidebar-foreground/80" />
                   <h3 className="mt-5 font-home-heading text-base font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-sidebar-foreground/65">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="fonctionnement" className="scroll-mt-20 border-y bg-card">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="font-home-heading text-xs font-semibold uppercase text-muted-foreground">Simple à prendre en main</p>
              <h2 className="mt-2 font-home-heading text-2xl font-bold text-primary sm:text-3xl">Du registre au rapport en trois étapes</h2>
              <TricolorBar className="my-4" />
              <p className="leading-7 text-muted-foreground">Chaque espace guide l'utilisateur vers les informations et actions liées à sa responsabilité.</p>
            </div>
            <div className="relative space-y-3 before:absolute before:bottom-8 before:left-5 before:top-8 before:w-px before:bg-border">
              {steps.map(({ title, desc }, index) => (
                <article key={title} className="relative flex gap-4 border bg-background p-5 shadow-soft">
                  <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center bg-primary font-home-heading text-sm font-bold text-primary-foreground">0{index + 1}</span>
                  <div><h3 className="font-home-heading font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{desc}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-secondary/55">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center">
            <div className="overflow-hidden border bg-card shadow-soft">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2"><img src={logoImg} alt="" className="h-8 w-8 object-contain" /><span className="font-home-heading text-sm font-bold text-primary">Aperçu GestionSco</span></div>
                <span className="flex items-center gap-1 text-xs text-success"><span className="h-2 w-2 bg-success" /> En ligne</span>
              </div>
              <div className="grid min-h-80 grid-cols-[72px_1fr] sm:grid-cols-[150px_1fr]">
                <div className="bg-sidebar p-3 text-sidebar-foreground">
                  <div className="space-y-3 text-[10px] sm:text-xs"><p className="bg-sidebar-accent p-2">Tableau de bord</p><p className="p-2">Candidats</p><p className="p-2">Notes</p><p className="p-2">Résultats</p></div>
                </div>
                <div className="p-4 sm:p-6">
                  <p className="font-home-heading text-sm font-bold">Synthèse de l'année</p>
                  <div className="mt-4 grid grid-cols-2 gap-3"><div className="border bg-pastel-blue p-3"><Users className="h-4 w-4 text-primary" /><p className="mt-5 text-xs font-semibold">Effectif</p></div><div className="border bg-pastel-mint p-3"><BarChart3 className="h-4 w-4 text-success" /><p className="mt-5 text-xs font-semibold">Résultats</p></div></div>
                  <div className="mt-3 border bg-card p-3"><div className="mb-4 h-2 w-28 bg-secondary" /><div className="flex h-24 items-end gap-2">{[45, 70, 52, 86, 64, 92].map((height, index) => <span key={index} className="flex-1 bg-primary/70" style={{ height: `${height}%` }} />)}</div></div>
                </div>
              </div>
            </div>
            <div>
              <p className="font-home-heading text-xs font-semibold uppercase text-muted-foreground">Un espace clair et cohérent</p>
              <h2 className="mt-2 font-home-heading text-2xl font-bold text-primary sm:text-3xl">L'essentiel visible dès la connexion</h2>
              <TricolorBar className="my-4" />
              <p className="leading-7 text-muted-foreground">La navigation s'adapte au profil connecté. Les tableaux, filtres et téléchargements restent regroupés dans un même environnement.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2"><p className="flex items-center gap-2 text-sm font-semibold"><MonitorSmartphone className="h-5 w-5 text-primary" /> Téléphone et ordinateur</p><p className="flex items-center gap-2 text-sm font-semibold"><WifiOff className="h-5 w-5 text-success" /> Travail hors connexion</p></div>
            </div>
          </div>
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
             <h2 className="font-home-heading text-2xl font-bold text-primary">Des avantages concrets au quotidien</h2>
            <TricolorBar className="mt-3" />
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {reminders.map(({ icon: Icon, title, border, tone }, index) => (
                <article key={title} className={`relative min-h-44 overflow-hidden border border-l-4 bg-background p-6 ${border}`}>
                   <span className="absolute right-4 top-1 font-home-heading text-6xl font-bold text-primary/10">0{index + 1}</span>
                  <div className={`grid h-10 w-10 place-items-center ${tone}`}><Icon className="h-5 w-5" /></div>
                  <h3 className="relative mt-6 max-w-[85%] font-heading text-sm font-bold uppercase leading-6 text-primary">{title}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="securite" className="scroll-mt-20 bg-sidebar text-sidebar-foreground">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div><Shield className="h-11 w-11 text-sidebar-foreground/80" /><p className="mt-6 font-home-heading text-xs font-semibold uppercase text-sidebar-foreground/65">Sécurité et continuité</p><h2 className="mt-2 font-home-heading text-2xl font-bold sm:text-3xl">Les bonnes informations, pour les bonnes personnes</h2><TricolorBar className="my-4" /><p className="text-sm leading-7 text-sidebar-foreground/75">Chaque compte dispose d'un espace distinct. Les archives restent protégées contre les modifications, sans empêcher leur consultation.</p></div>
            <div className="grid gap-px border border-sidebar-border bg-sidebar-border sm:grid-cols-2">
              {[{ icon: ShieldCheck, title: "Accès par rôle", text: "Les menus et actions correspondent au profil connecté." }, { icon: Archive, title: "Archives protégées", text: "Les anciennes années restent en lecture et téléchargement." }, { icon: WifiOff, title: "Continuité hors ligne", text: "Le travail prévu hors connexion reste disponible." }, { icon: Sparkles, title: "Sauvegarde assistée", text: "La saisie des notes conserve son enregistrement automatique." }].map(({ icon: Icon, title, text }) => <article key={title} className="bg-sidebar p-5"><Icon className="h-6 w-6" /><h3 className="mt-4 font-home-heading text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-sidebar-foreground/65">{text}</p></article>)}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 bg-card">
          <div className="mx-auto grid max-w-7xl gap-9 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.65fr_1.35fr]">
            <div><HelpCircle className="h-9 w-9 text-primary" /><h2 className="mt-5 font-home-heading text-2xl font-bold text-primary">Questions fréquentes</h2><TricolorBar className="my-4" /><p className="text-sm leading-6 text-muted-foreground">Les réponses essentielles avant d'ouvrir votre espace.</p></div>
            <div className="divide-y border-y">
              {faqs.map(({ question, answer }) => <details key={question} className="group py-1"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-home-heading text-sm font-bold"><span>{question}</span><ChevronRight className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-90" /></summary><p className="pb-5 pr-8 text-sm leading-6 text-muted-foreground">{answer}</p></details>)}
            </div>
          </div>
        </section>

        <section className="border-t bg-secondary/55"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center bg-pastel-blue text-primary"><GraduationCap className="h-6 w-6" /></div>
            <div>
               <h2 className="font-home-heading text-xl font-bold text-primary">Prêt à ouvrir votre espace GestionSco ?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Connectez-vous pour choisir l'année scolaire et ouvrir votre espace.</p>
            </div>
          </div>
           <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => navigate("/resultats")}>Consulter un résultat</Button><Button onClick={() => navigate("/login")}><LogIn />Se connecter</Button></div>
         </div></section>
      </main>

       <footer className="bg-sidebar text-sidebar-foreground"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto_auto]"><div className="flex items-start gap-3"><span className="grid h-10 w-10 bg-card p-1"><img src={logoImg} alt="GestionSco" className="h-full w-full object-contain" /></span><div><p className="font-home-heading font-bold">GestionSco</p><p className="mt-1 max-w-sm text-xs leading-5 text-sidebar-foreground/65">Plateforme de gestion scolaire de la Circonscription Scolaire de Bantè.</p></div></div><div><p className="font-home-heading text-xs font-bold uppercase">Accès</p><div className="mt-3 space-y-2 text-xs text-sidebar-foreground/65"><button onClick={() => navigate("/login")} className="block hover:text-sidebar-foreground">Connexion</button><button onClick={() => navigate("/resultats")} className="block hover:text-sidebar-foreground">Résultats publics</button></div></div><div><p className="font-home-heading text-xs font-bold uppercase">Année active</p><p className="mt-3 text-xs text-sidebar-foreground/65">2026-2027</p></div></div><div className="border-t border-sidebar-border px-4 py-5 text-center text-xs text-sidebar-foreground/55">GestionSco v1.0 · Circonscription Scolaire de Bantè</div></footer>
    </div>
  );
}