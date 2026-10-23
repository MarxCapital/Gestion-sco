import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, UserPlus, Users, Upload, Trash2, RefreshCw, Key, Loader2, Copy, PlusCircle, Pencil, Check, X, ArrowUp, ArrowDown, Code2, Download, BookOpen, GraduationCap } from "lucide-react";
import { generateCandidatesPdf } from "@/lib/pdf-utils";
import { sortByOrder } from "@/lib/calculations";
import CandidateImport from "@/components/CandidateImport";
import DeveloperPanel from "@/components/DeveloperPanel";
import ClassResources from "@/components/ClassResources";
import Cm2Tools from "@/components/school/Cm2Tools";
import AppShell, { type ShellSection } from "@/components/AppShell";
import PageBanner from "@/components/portal/PageBanner";
import { useAppSettings } from "@/hooks/use-app-settings";
import logoImg from "@/assets/brand";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { sortAlphabetically } from "@/lib/calculations";
import { getSchoolYear } from "@/lib/school-year";
import YearSwitcher from "@/components/YearSwitcher";

const BULK_CENTERS = [
  "AGOUA", "AKPASSI", "ALLOBA", "ELEBADE", "GOUKA", "GOUKA ZOHOUNGO",
  "KAMOUANOUDE", "KOKO", "Lougba", "ODOKOTO", "Mayamon", "Idiogou", "Bantè", "Pira"
];

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
};

const adminSections: ShellSection[] = [
  {
    label: "Comptes",
    items: [
      { value: "create", label: "Créer un compte", icon: UserPlus },
      { value: "manage", label: "Gérer centres & candidats", icon: Users },
    ],
  },
  {
    label: "Candidats",
    items: [{ value: "import", label: "Importer candidats", icon: Upload }],
  },
  {
    label: "Écoles",
    items: [
      { value: "resources", label: "Guides & fiches", icon: BookOpen },
      { value: "schooldocs", label: "Dossiers écoles", icon: GraduationCap },
    ],
  },
  {
    label: "Système",
    items: [{ value: "dev", label: "Développeur", icon: Code2 }],
  },
];

const AdminDashboard = () => {
  const { signOut, profile } = useAuth();
  const { settings } = useAppSettings();
  const [newIdentifier, setNewIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"center" | "csbante" | "independent" | "school">("center");
  const [creating, setCreating] = useState(false);
  const [centers, setCenters] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<string>("");
  const [bulkCreating, setBulkCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ identifier: string; password: string }[]>([]);
  const [bulkResetting, setBulkResetting] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<Record<string, any>>({});
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [copyTargetCenterId, setCopyTargetCenterId] = useState("");
  const [copyingCandidates, setCopyingCandidates] = useState(false);

  const startEditCandidate = (c: any) => {
    setEditingCandidate({ id: c.id, numero_table: c.numero_table ?? '', nom: c.nom ?? '', prenoms: c.prenoms ?? '', sexe: c.sexe ?? '', ecole_provenance: c.ecole_provenance ?? '' });
  };
  const cancelEditCandidate = () => setEditingCandidate({});
  const saveEditCandidate = async () => {
    const { id, ...changes } = editingCandidate;
    const { error } = await supabase.from("candidates").update(changes as any).eq("id", id);
    if (error) { toast.error("Erreur sauvegarde"); return; }
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
    setEditingCandidate({});
    toast.success("Candidat modifié");
  };
  const [editNameValue, setEditNameValue] = useState("");

  const handleGeneratePassword = () => setNewPassword(generatePassword());

  const [docSchoolId, setDocSchoolId] = useState("");
  const [active, setActive] = useState("create");
  const selectSection = (v: string) => { setActive(v); if (v === "manage") loadCenters(); };
  const loadCenters = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").neq("identifier", "Marx"),
      supabase.from("user_roles").select("*"),
    ]);
    const allProfiles = (profiles as any) || [];
    const allRoles = (roles as any) || [];
    setCenters(allProfiles.map((p: any) => ({ ...p, role: allRoles.find((r: any) => r.user_id === p.id)?.role })));
  };

  const loadCandidates = async (cId: string) => {
    setSelectedCenter(cId);
    setSelectedCandidateIds([]);
    setCopyTargetCenterId("");
    const { data } = await supabase.from("candidates").select("*").eq("school_year", getSchoolYear()).eq("center_id", cId).order("sort_order" as any);
    setCandidates((data as any) || []);
  };

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedCandidateIds.includes(candidate.id)),
    [candidates, selectedCandidateIds]
  );

  const independentCenters = useMemo(
    () => centers.filter((center) => center.role === "independent" && center.id !== selectedCenter),
    [centers, selectedCenter]
  );

  const allCandidatesSelected = candidates.length > 0 && selectedCandidateIds.length === candidates.length;

  const toggleCandidateSelection = (candidateId: string, checked: boolean) => {
    setSelectedCandidateIds((prev) =>
      checked ? Array.from(new Set([...prev, candidateId])) : prev.filter((id) => id !== candidateId)
    );
  };

  const toggleAllCandidates = (checked: boolean) => {
    setSelectedCandidateIds(checked ? candidates.map((candidate) => candidate.id) : []);
  };

  const handleCopySelectedCandidates = async () => {
    if (!copyTargetCenterId) {
      toast.error("Choisissez un centre indépendant");
      return;
    }
    if (selectedCandidates.length === 0) {
      toast.error("Sélectionnez au moins un apprenant");
      return;
    }

    setCopyingCandidates(true);
    try {
      const { data: destinationCandidates, error: destinationError } = await supabase
        .from("candidates")
        .select("*")
        .eq("school_year", getSchoolYear())
        .eq("center_id", copyTargetCenterId);

      if (destinationError) throw destinationError;

      const existingRows = (destinationCandidates as any[]) || [];
      const combined = sortAlphabetically([
        ...existingRows.map((candidate) => ({ ...candidate, __kind: "existing" as const })),
        ...selectedCandidates.map((candidate) => ({
          center_id: copyTargetCenterId,
          numero_table: candidate.numero_table,
          nom: candidate.nom,
          prenoms: candidate.prenoms,
          sexe: candidate.sexe,
          ecole_provenance: candidate.ecole_provenance,
          is_absent: candidate.is_absent,
          __kind: "new" as const,
        })),
      ]);

      const existingUpdates = combined
        .filter((candidate) => candidate.__kind === "existing")
        .map((candidate, index) => ({ id: candidate.id, sort_order: index + 1 }));

      const newRows = combined
        .filter((candidate) => candidate.__kind === "new")
        .map((candidate, index) => ({
          center_id: candidate.center_id,
          school_year: getSchoolYear(),
          numero_table: candidate.numero_table,
          nom: candidate.nom,
          prenoms: candidate.prenoms,
          sexe: candidate.sexe,
          ecole_provenance: candidate.ecole_provenance,
          is_absent: candidate.is_absent,
          sort_order: index + 1,
        }));

      await Promise.all(
        existingUpdates.map((candidate) =>
          supabase.from("candidates").update({ sort_order: candidate.sort_order } as any).eq("id", candidate.id)
        )
      );

      if (newRows.length > 0) {
        const { error: insertError } = await supabase.from("candidates").insert(newRows as any);
        if (insertError) throw insertError;
      }

      setSelectedCandidateIds([]);
      setCopyTargetCenterId("");
      toast.success(`${newRows.length} apprenant(s) copié(s) vers le centre indépendant`);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la copie");
    } finally {
      setCopyingCandidates(false);
    }
  };

  const moveCandidate = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= candidates.length) return;
    const updated = [...candidates];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    // Update sort_order for all
    const withOrder = updated.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setCandidates(withOrder);
    // Persist to DB
    for (const c of withOrder) {
      await supabase.from("candidates").update({ sort_order: c.sort_order } as any).eq("id", c.id);
    }
    toast.success("Position mise à jour");
  };

  useEffect(() => { loadCenters(); }, []);

  const callEdgeFunction = async (fnName: string, body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);
    return data;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdentifier.trim() || !newPassword.trim()) { toast.error("Remplissez tous les champs"); return; }
    setCreating(true);
    try {
      await callEdgeFunction("create-user", {
        identifier: newIdentifier.trim(),
        password: newPassword.trim(),
        role: newRole,
        display_name: newIdentifier.trim(),
      });
      toast.success(`Compte "${newIdentifier}" créé`);
      setCreatedCredentials(prev => [...prev, { identifier: newIdentifier.trim(), password: newPassword.trim() }]);
      setNewIdentifier(""); setNewPassword("");
      loadCenters();
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const handleBulkCreate = async () => {
    setBulkCreating(true);
    const creds: { identifier: string; password: string }[] = [];
    const existingIds = centers.map(c => c.identifier?.toLowerCase());

    for (const name of BULK_CENTERS) {
      const identifier = `Centre ${name}`;
      const loginId = `centre${name.toLowerCase().replace(/\s+/g, "")}`;

      if (existingIds.includes(identifier.toLowerCase()) || existingIds.includes(loginId.toLowerCase())) {
        continue; // skip existing
      }

      const pwd = generatePassword();
      try {
        await callEdgeFunction("create-user", {
          identifier: loginId,
          password: pwd,
          role: "center",
          display_name: identifier,
        });
        creds.push({ identifier: loginId, password: pwd });
      } catch (e: any) {
        console.error(`Erreur création ${identifier}:`, e.message);
      }
    }

    setCreatedCredentials(prev => [...prev, ...creds]);
    toast.success(`${creds.length} centres créés`);
    loadCenters();
    setBulkCreating(false);
  };

  const handleResetPassword = async (userId: string, identifier: string) => {
    setResettingId(userId);
    const pwd = generatePassword();
    try {
      await callEdgeFunction("reset-password", { user_id: userId, new_password: pwd });
      toast.success(`Mot de passe réinitialisé pour ${identifier}`);
      setCreatedCredentials(prev => [...prev, { identifier, password: pwd }]);
    } catch (e: any) { toast.error(e.message); }
    finally { setResettingId(null); }
  };

  const handleBulkResetPasswords = async () => {
    const centersList = centers.filter(c => c.role === 'center');
    if (centersList.length === 0) { toast.error("Aucun centre à réinitialiser"); return; }
    setBulkResetting(true);
    const creds: { identifier: string; password: string }[] = [];
    for (const c of centersList) {
      const pwd = generatePassword();
      try {
        await callEdgeFunction("reset-password", { user_id: c.id, new_password: pwd });
        creds.push({ identifier: c.identifier, password: pwd });
      } catch (e: any) {
        console.error(`Erreur reset ${c.identifier}:`, e.message);
      }
    }
    setCreatedCredentials(prev => [...prev, ...creds]);
    toast.success(`${creds.length} mots de passe réinitialisés`);
    loadCenters();
    setBulkResetting(false);
  };

  const handleDeleteUser = async (userId: string, identifier: string) => {
    setDeletingId(userId);
    try {
      await callEdgeFunction("delete-user", { user_id: userId });
      toast.success(`Compte "${identifier}" supprimé`);
      setCenters(prev => prev.filter(c => c.id !== userId));
      if (selectedCenter === userId) { setSelectedCenter(""); setCandidates([]); }
    } catch (e: any) { toast.error(e.message); }
    finally { setDeletingId(null); }
  };

  const deleteCandidate = async (id: string) => {
    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    setCandidates(prev => prev.filter(c => c.id !== id));
    toast.success("Candidat supprimé");
  };

  const deleteAllCandidates = async (cId: string) => {
    const { error } = await supabase.from("candidates").delete().eq("school_year", getSchoolYear()).eq("center_id", cId);
    if (error) { toast.error("Erreur"); return; }
    setCandidates([]);
    toast.success("Tous les candidats supprimés");
  };

  const startEditName = (center: any) => {
    setEditingNameId(center.id);
    setEditNameValue(center.display_name || center.identifier || "");
  };

  const saveDisplayName = async (centerId: string) => {
    const { error } = await supabase.from("profiles").update({ display_name: editNameValue.trim() }).eq("id", centerId);
    if (error) { toast.error("Erreur de mise à jour"); return; }
    setCenters(prev => prev.map(c => c.id === centerId ? { ...c, display_name: editNameValue.trim() } : c));
    setEditingNameId(null);
    toast.success("Nom du centre mis à jour");
  };

  const copyCredentials = () => {
    const text = createdCredentials.map(c => `${c.identifier} : ${c.password}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Identifiants copiés dans le presse-papier");
  };

  const centerAccounts = centers.filter(c => c.role === 'center' || c.role === 'independent');

  const activeItem = adminSections.flatMap(x => x.items).find(i => i.value === active);
  return (
    <AppShell title="GestionSco - Admin" subtitle={`Connecté : ${profile?.identifier ?? ""}`} sections={adminSections} active={active} onSelect={selectSection}>
      <PageBanner title={activeItem?.label || "Administration"} description="Administration de la plateforme GestionSco." icon={activeItem?.icon} />
      <Tabs value={active} onValueChange={selectSection} className="mt-6">
          <TabsContent value="create">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Créer un nouveau compte</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <div className="flex gap-2 flex-wrap">
                        <Button type="button" variant={newRole === "center" ? "default" : "outline"} size="sm" onClick={() => setNewRole("center")}>Centre</Button>
                        <Button type="button" variant={newRole === "csbante" ? "default" : "outline"} size="sm" onClick={() => setNewRole("csbante")}>CSBanté</Button>
                        <Button type="button" variant={newRole === "independent" ? "default" : "outline"} size="sm" onClick={() => setNewRole("independent")}>Indépendant</Button>
                        <Button type="button" variant={newRole === "school" ? "default" : "outline"} size="sm" onClick={() => setNewRole("school")}>École</Button>
                      </div>
                    </div>
                    <div className="space-y-2"><Label>Identifiant</Label><Input value={newIdentifier} onChange={e => setNewIdentifier(e.target.value)} placeholder="ex: centreagoua" /></div>
                    <div className="space-y-2">
                      <Label>Mot de passe</Label>
                      <div className="flex gap-2">
                        <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} className="font-mono" readOnly />
                        <Button type="button" variant="outline" size="icon" onClick={handleGeneratePassword} title="Générer"><RefreshCw className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <Button type="submit" disabled={creating} className="w-full"><UserPlus className="w-4 h-4 mr-2" />{creating ? "Création..." : "Créer le compte"}</Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><PlusCircle className="w-5 h-5" /> Création rapide des centres</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Créer automatiquement les {BULK_CENTERS.length} centres avec des mots de passe générés :</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {BULK_CENTERS.map(n => (
                      <span key={n} className="bg-muted px-2 py-1 rounded">Centre {n}</span>
                    ))}
                  </div>
                  <Button onClick={handleBulkCreate} disabled={bulkCreating} className="w-full">
                    {bulkCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                    {bulkCreating ? "Création en cours..." : `Créer les ${BULK_CENTERS.length} centres`}
                  </Button>
                </CardContent>
              </Card>

              {createdCredentials.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" /> Identifiants créés ({createdCredentials.length})</CardTitle>
                      <Button variant="outline" size="sm" onClick={copyCredentials}><Copy className="w-4 h-4 mr-1" />Copier tout</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-muted"><tr><th className="p-2 text-left">Identifiant</th><th className="p-2 text-left">Mot de passe</th></tr></thead>
                        <tbody>
                          {createdCredentials.map((c, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2 font-medium">{c.identifier}</td>
                              <td className="p-2 font-mono">{c.password}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="import">
            <Card>
              <CardHeader><CardTitle>Importer une liste de candidats (OCR IA)</CardTitle></CardHeader>
              <CardContent>
                {settings.candidate_import_enabled ? (
                  <CandidateImport centers={centerAccounts} onImported={loadCenters} />
                ) : (
                  <p className="text-sm text-muted-foreground">L'import IA des candidats est désactivé. Activez-le dans l'onglet « Développeur ».</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources">
            <Card><CardContent className="p-4 sm:p-6"><ClassResources mode="admin" /></CardContent></Card>
          </TabsContent>

          <TabsContent value="schooldocs">
            <Card>
              <CardHeader><CardTitle>Dossiers des écoles : photos et fiches scolaires</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 max-w-md">
                  <Label>École concernée</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={docSchoolId}
                    onChange={e => setDocSchoolId(e.target.value)}
                  >
                    <option value="">Autre école (saisie libre)</option>
                    {centers.filter((c: any) => c.role === "school").map((c: any) => (
                      <option key={c.id} value={c.id}>{c.school_name || c.display_name || c.identifier}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Changer d'école remet à zéro la liste et les photos chargées.</p>
                </div>
                <Cm2Tools
                  key={docSchoolId || "libre"}
                  schoolId={docSchoolId || null}
                  schoolName={(() => { const c: any = centers.find((x: any) => x.id === docSchoolId); return c ? (c.school_name || c.display_name || c.identifier) : ""; })()}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dev">
            <DeveloperPanel />
          </TabsContent>

          <TabsContent value="manage">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle>Comptes ({centers.length})</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleBulkResetPasswords} disabled={bulkResetting}>
                      {bulkResetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                      {bulkResetting ? "Réinitialisation..." : "Réinitialiser tous les mots de passe"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {centers.length === 0 ? <p className="text-muted-foreground">Aucun compte.</p> : (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Nom</th>
                            <th className="p-2 text-left">Identifiant</th>
                            <th className="p-2 text-left">Mot de passe</th>
                            <th className="p-2 text-left">Rôle</th>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {centers.map(c => (
                            <tr key={c.id} className="border-t">
                              <td className="p-2 font-medium">
                                {editingNameId === c.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input value={editNameValue} onChange={e => setEditNameValue(e.target.value)} className="h-7 text-sm w-40" />
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => saveDisplayName(c.id)}><Check className="w-3 h-3 text-green-600" /></Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingNameId(null)}><X className="w-3 h-3 text-destructive" /></Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span>{c.display_name || c.identifier}</span>
                                    {(c.role === 'center' || c.role === 'independent') && <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEditName(c)}><Pencil className="w-3 h-3" /></Button>}
                                  </div>
                                )}
                              </td>
                              <td className="p-2 text-muted-foreground">{c.identifier}</td>
                              <td className="p-2 font-mono text-xs">{c.generated_password || '—'}</td>
                              <td className="p-2"><span className="text-xs bg-muted px-2 py-0.5 rounded">{c.role}</span></td>
                              <td className="p-2 text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString("fr-FR")}</td>
                              <td className="p-2">
                                <div className="flex gap-1 justify-end">
                                  {(c.role === 'center' || c.role === 'independent') && (
                                    <>
                                      <Button variant="outline" size="sm" onClick={() => loadCandidates(c.id)}>Candidats</Button>
                                      <Button variant="outline" size="sm" onClick={() => handleResetPassword(c.id, c.identifier)} disabled={resettingId === c.id}>
                                        {resettingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
                                      </Button>
                                    </>
                                  )}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm" disabled={deletingId === c.id}>
                                        {deletingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Supprimer le compte</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Voulez-vous vraiment supprimer le compte « {c.identifier} » ? Cette action supprimera aussi tous ses candidats et ne peut pas être annulée.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteUser(c.id, c.identifier)}>Supprimer</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedCenter && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Candidats du centre ({candidates.length})</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          const center = centers.find(c => c.id === selectedCenter);
                          const name = center?.display_name || center?.identifier || "Centre";
                          generateCandidatesPdf(sortByOrder(candidates as any), {
                            documentTitle: `Liste des candidats - ${name}`,
                            centerName: name,
                            effectif: candidates.length,
                            signatureRole: 'none',
                          });
                          toast.success("Liste téléchargée");
                        }}><Download className="w-3 h-3 mr-1" />Télécharger</Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteAllCandidates(selectedCenter)}><Trash2 className="w-3 h-3 mr-1" />Supprimer tout</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {candidates.length === 0 ? <p className="text-muted-foreground">Aucun candidat.</p> : (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3 text-sm">
                            <Checkbox
                              checked={allCandidatesSelected}
                              onCheckedChange={(checked) => toggleAllCandidates(checked === true)}
                              aria-label="Sélectionner tous les apprenants"
                            />
                            <span className="font-medium">
                              {selectedCandidateIds.length} apprenant(s) sélectionné(s)
                            </span>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Select value={copyTargetCenterId} onValueChange={setCopyTargetCenterId}>
                              <SelectTrigger className="w-full sm:w-[260px]">
                                <SelectValue placeholder="Choisir un centre indépendant" />
                              </SelectTrigger>
                              <SelectContent>
                                {independentCenters.map((center) => (
                                  <SelectItem key={center.id} value={center.id}>
                                    {center.display_name || center.identifier}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              onClick={handleCopySelectedCandidates}
                              disabled={copyingCandidates || selectedCandidateIds.length === 0 || !copyTargetCenterId}
                            >
                              {copyingCandidates ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                              Copier vers un centre indépendant
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-muted"><tr><th className="p-2 text-center w-12"><Checkbox checked={allCandidatesSelected} onCheckedChange={(checked) => toggleAllCandidates(checked === true)} aria-label="Sélectionner tous les apprenants" /></th><th className="p-2 text-center w-16">Pos.</th><th className="p-2 text-left">N°</th><th className="p-2 text-left">Nom</th><th className="p-2 text-left">Prénom(s)</th><th className="p-2 text-left">Sexe</th><th className="p-2 text-left">École</th><th className="p-2 text-center">Déplacer</th><th className="p-2 text-center">Actions</th></tr></thead>
                          <tbody>
                            {candidates.map((c, idx) => {
                              const isEd = editingCandidate.id === c.id;
                              return (
                              <tr key={c.id} className="border-t">
                                <td className="p-2 text-center">
                                  <Checkbox
                                    checked={selectedCandidateIds.includes(c.id)}
                                    onCheckedChange={(checked) => toggleCandidateSelection(c.id, checked === true)}
                                    aria-label={`Sélectionner ${c.nom} ${c.prenoms || ""}`.trim()}
                                  />
                                </td>
                                <td className="p-2 text-center text-muted-foreground text-xs">{idx + 1}</td>
                                <td className="p-2">{isEd ? <Input className="h-7 text-xs w-20" value={editingCandidate.numero_table} onChange={e => setEditingCandidate(p => ({ ...p, numero_table: e.target.value }))} /> : c.numero_table}</td>
                                <td className="p-2">{isEd ? <Input className="h-7 text-xs" value={editingCandidate.nom} onChange={e => setEditingCandidate(p => ({ ...p, nom: e.target.value }))} /> : c.nom}</td>
                                <td className="p-2">{isEd ? <Input className="h-7 text-xs" value={editingCandidate.prenoms} onChange={e => setEditingCandidate(p => ({ ...p, prenoms: e.target.value }))} /> : c.prenoms}</td>
                                <td className="p-2">{isEd ? <Input className="h-7 text-xs w-14" value={editingCandidate.sexe} onChange={e => setEditingCandidate(p => ({ ...p, sexe: e.target.value }))} /> : c.sexe}</td>
                                <td className="p-2">{isEd ? <Input className="h-7 text-xs" value={editingCandidate.ecole_provenance} onChange={e => setEditingCandidate(p => ({ ...p, ecole_provenance: e.target.value }))} /> : c.ecole_provenance}</td>
                                <td className="p-2 text-center">
                                  <div className="flex gap-0.5 justify-center">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={idx === 0} onClick={() => moveCandidate(idx, "up")}><ArrowUp className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={idx === candidates.length - 1} onClick={() => moveCandidate(idx, "down")}><ArrowDown className="w-3 h-3" /></Button>
                                  </div>
                                </td>
                                <td className="p-2">
                                  <div className="flex gap-0.5 justify-center">
                                    {!settings.admin_can_edit_candidates ? (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    ) : isEd ? (
                                      <>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={saveEditCandidate}><Check className="w-3 h-3 text-green-600" /></Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={cancelEditCandidate}><X className="w-3 h-3 text-destructive" /></Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEditCandidate(c)}><Pencil className="w-3 h-3" /></Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteCandidate(c.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );})}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
    </AppShell>
  );
};

export default AdminDashboard;
