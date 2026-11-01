import { useEffect, useState } from "react";
import { useAppSettings, AppSettingKey } from "@/hooks/use-app-settings";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import {
  Loader2, AlertTriangle, ShieldCheck, Users, FileEdit, Globe, Upload,
  KeyRound, UserX, Wrench, Save, Trash2, UserCircle2, Eraser,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import TableNumberGenerator from "@/components/TableNumberGenerator";
import { useSchoolYear } from "@/contexts/SchoolYearContext";
import { ACTIVE_SCHOOL_YEAR, lockSettingKey, type SchoolYear } from "@/lib/school-year";

const META: Record<AppSettingKey, { label: string; help: string; icon: React.ComponentType<any>; danger?: boolean }> = {
  maintenance_mode: {
    label: "Maintenance — CS & centres reliés",
    help: "Bloque l'accès à la CS et aux centres qui lui sont reliés (sauf admin).",
    icon: AlertTriangle,
    danger: true,
  },
  maintenance_mode_independent: {
    label: "Maintenance — Comptes indépendants",
    help: "Bloque l'accès à tous les comptes indépendants (sauf admin).",
    icon: AlertTriangle,
    danger: true,
  },
  centers_can_edit_candidates: {
    label: "Centres : modifier les apprenants",
    help: "Autorise les centres à modifier la liste de leurs candidats.",
    icon: FileEdit,
  },
  admin_can_edit_candidates: {
    label: "Admin : modifier les apprenants",
    help: "Autorise l'admin à éditer les candidats depuis le tableau de bord.",
    icon: ShieldCheck,
  },
  centers_can_mark_absent: {
    label: "Centres : marquer absent",
    help: "Autorise les centres à cocher la case « absent » d'un candidat.",
    icon: UserX,
  },
  centers_can_edit_notes: {
    label: "Centres : saisir les notes",
    help: "Autorise les centres à saisir et modifier les notes.",
    icon: FileEdit,
  },
  csbante_can_edit_candidates: {
    label: "CSBanté : modifier les apprenants",
    help: "Autorise CSBanté à corriger les informations des candidats.",
    icon: Users,
  },
  public_results_enabled: {
    label: "Portail public des résultats",
    help: "Active la page /resultats accessible sans connexion.",
    icon: Globe,
  },
  candidate_import_enabled: {
    label: "Import IA des candidats",
    help: "Active l'import OCR/IA des candidats depuis un PDF.",
    icon: Upload,
  },
  allow_concurrent_center_sessions: {
    label: "Connexions simultanées par centre",
    help: "Si activé, plusieurs appareils peuvent utiliser le même compte centre.",
    icon: KeyRound,
  },
};

const ORDER: AppSettingKey[] = [
  "maintenance_mode",
  "maintenance_mode_independent",
  "centers_can_edit_candidates",
  "centers_can_edit_notes",
  "centers_can_mark_absent",
  "admin_can_edit_candidates",
  "csbante_can_edit_candidates",
  "candidate_import_enabled",
  "public_results_enabled",
  "allow_concurrent_center_sessions",
];

const DeleteNotesDialog = ({
  scope,
  label,
  icon: Icon,
}: {
  scope: "linked" | "independent";
  label: string;
  icon: React.ComponentType<any>;
}) => {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (confirm !== "SUPPRIMER") {
      toast.error("Tapez SUPPRIMER pour confirmer");
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/delete-all-notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ scope, confirm }),
        },
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erreur");
      toast.success(`${data.deleted} série(s) de notes supprimée(s)`);
      setOpen(false);
      setConfirm("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirm(""); }}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full justify-start">
          <Icon className="w-4 h-4 mr-2" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Action irréversible
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              Vous êtes sur le point de supprimer <strong>toutes les notes</strong>{" "}
              {scope === "linked"
                ? "des comptes reliés à la CS (centres et CSBanté)"
                : "des comptes indépendants"}
              . Les candidats ne seront <strong>pas</strong> supprimés.
            </span>
            <span className="block">
              Pour confirmer, tapez <strong className="font-mono">SUPPRIMER</strong> ci-dessous :
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="SUPPRIMER"
          className="font-mono"
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={loading || confirm !== "SUPPRIMER"}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Supprimer définitivement
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const ClearAbsencesDialog = () => {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    if (confirm !== "SUPPRIMER") {
      toast.error("Tapez SUPPRIMER pour confirmer");
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/clear-all-absences`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ confirm }),
        },
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erreur");
      toast.success(`${data.cleared} absence(s) effacée(s)`);
      setOpen(false);
      setConfirm("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirm(""); }}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full justify-start">
          <Eraser className="w-4 h-4 mr-2" />
          Effacer toutes les absences marquées
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Action irréversible
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              Vous êtes sur le point de retirer la marque <strong>« absent »</strong> de
              <strong> tous les candidats</strong> de la plateforme. Les candidats et
              leurs notes ne seront pas supprimés.
            </span>
            <span className="block">
              Pour confirmer, tapez <strong className="font-mono">SUPPRIMER</strong> ci-dessous :
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="SUPPRIMER"
          className="font-mono"
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleClear(); }}
            disabled={loading || confirm !== "SUPPRIMER"}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eraser className="w-4 h-4 mr-2" />}
            Effacer définitivement
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const DeveloperPanel = () => {
  const { settings, textSettings, loading, updateSetting, updateTextSetting } = useAppSettings();
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [savingMaint, setSavingMaint] = useState(false);

  useEffect(() => {
    setMsg(textSettings.maintenance_message);
    setEmail(textSettings.maintenance_contact_email);
    setPhone(textSettings.maintenance_contact_phone);
  }, [textSettings]);

  const { year: viewedYear, years: allYears, readOnly: viewedReadOnly } = useSchoolYear();
  const [lockYear, setLockYear] = useState<SchoolYear>(viewedYear);
  const [lockedMap, setLockedMap] = useState<Record<string, boolean>>({});

  const loadLocks = async () => {
    const { data } = await (supabase.from as any)("app_settings").select("key,value").like("key", "year_locked_%");
    const m: Record<string, boolean> = {};
    (data ?? []).forEach((r: { key: string; value: boolean }) => { m[r.key] = r.value; });
    setLockedMap(m);
  };
  useEffect(() => { loadLocks(); }, [viewedReadOnly]);

  const toggleYearLock = async (y: SchoolYear, locked: boolean) => {
    const { error } = await (supabase.from as any)("app_settings").upsert({
      key: lockSettingKey(y),
      value: locked,
      description: `Année ${y} en lecture seule`,
      updated_at: new Date().toISOString(),
    });
    if (error) { toast.error("Impossible de modifier le verrou (migration SQL appliquée ?)"); return; }
    setLockedMap((m) => ({ ...m, [lockSettingKey(y)]: locked }));
    toast.success(`Année ${y} : ${locked ? "lecture seule" : "modification autorisée"}`);
  };

  const onToggle = async (key: AppSettingKey, value: boolean) => {
    const ok = await updateSetting(key, value);
    if (ok) {
      toast.success(`${META[key].label} : ${value ? "activé" : "désactivé"}`);
    } else {
      toast.error("Impossible de mettre à jour le paramètre");
    }
  };

  const saveMaintenanceContent = async () => {
    setSavingMaint(true);
    const results = await Promise.all([
      updateTextSetting("maintenance_message", msg),
      updateTextSetting("maintenance_contact_email", email),
      updateTextSetting("maintenance_contact_phone", phone),
    ]);
    setSavingMaint(false);
    if (results.every(Boolean)) {
      toast.success("Page de maintenance mise à jour");
    } else {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(settings.maintenance_mode || settings.maintenance_mode_independent) && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Maintenance active</p>
              <p className="text-muted-foreground">
                {settings.maintenance_mode && "CS & centres reliés bloqués. "}
                {settings.maintenance_mode_independent && "Comptes indépendants bloqués. "}
                Seul l'admin peut accéder à la plateforme.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Page de maintenance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Ces informations s'affichent sur la page vue par les utilisateurs lorsque le mode maintenance est activé.
          </p>
          <div className="space-y-2">
            <Label htmlFor="maint-msg">Message affiché</Label>
            <Textarea
              id="maint-msg"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={4}
              placeholder="Ex : La plateforme est en maintenance jusqu'à 18h…"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="maint-email">Email de support</Label>
              <Input
                id="maint-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="support@gestionsco.app"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maint-phone">Téléphone de support</Label>
              <Input
                id="maint-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+229 01 00 00 00 00"
              />
            </div>
          </div>
          <Button onClick={saveMaintenanceContent} disabled={savingMaint} size="sm">
            {savingMaint ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer la page
          </Button>
        </CardContent>
      </Card>

      <TableNumberGenerator />

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" /> Réinitialisation des notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Supprime <strong>toutes les notes</strong> saisies. Les candidats restent intacts.
            Action irréversible — confirmation par saisie obligatoire.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <DeleteNotesDialog
              scope="linked"
              label="Effacer les notes — CS & centres reliés"
              icon={Users}
            />
            <DeleteNotesDialog
              scope="independent"
              label="Effacer les notes — Comptes indépendants"
              icon={UserCircle2}
            />
          </div>
          <div className="pt-2 border-t border-destructive/20">
            <p className="text-xs text-muted-foreground mb-2">
              Retire la marque <strong>« absent »</strong> de tous les candidats sur la plateforme.
            </p>
            <ClearAbsencesDialog />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Année scolaire — lecture seule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Choisissez une année puis verrouillez-la : plus personne (centres, écoles, CS, admin) ne pourra y saisir ni modifier de données.
            Les années archivées sont toujours en lecture seule ; l'année {ACTIVE_SCHOOL_YEAR} est modifiable tant que vous ne la verrouillez pas.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={lockYear}
              onChange={(e) => setLockYear(e.target.value as SchoolYear)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {allYears.map((y) => <option key={y} value={y}>Année {y}</option>)}
            </select>
            {lockYear !== ACTIVE_SCHOOL_YEAR ? (
              <span className="text-sm text-muted-foreground">Archive : toujours en lecture seule.</span>
            ) : (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={!!lockedMap[lockSettingKey(lockYear)]}
                  onCheckedChange={(v) => toggleYearLock(lockYear, v)}
                />
                Mettre cette année en lecture seule
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions & contrôles plateforme</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {ORDER.map((key) => {
            const meta = META[key];
            const Icon = meta.icon;
            return (
              <div key={key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor={`set-${key}`} className="text-sm font-medium cursor-pointer">
                      {meta.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.help}</p>
                  </div>
                </div>
                <Switch
                  id={`set-${key}`}
                  checked={settings[key]}
                  onCheckedChange={(v) => onToggle(key, v)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeveloperPanel;
