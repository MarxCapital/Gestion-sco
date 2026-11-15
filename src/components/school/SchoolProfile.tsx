import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadSchoolStatus, saveSchoolStatus, type SchoolStatus } from "@/lib/school-status";
import { RESOURCE_CLASSES, normalizeResourceClass } from "@/lib/class-resource-rules";

interface Props { schoolId: string }

const SchoolProfile = ({ schoolId }: Props) => {
  const { refreshProfile } = useAuth();
  const [form, setForm] = useState({ display_name: "", school_name: "", class_name: "", teacher_name: "", phone: "", photo_url: "" });
  const [status, setStatus] = useState<SchoolStatus | "">("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", schoolId).single();
    if (data) {
      const p = data as any;
      setForm({
        display_name: p.display_name ?? "",
        school_name: p.school_name ?? "",
        class_name: normalizeResourceClass(p.class_name) ?? "",
        teacher_name: p.teacher_name ?? "",
        phone: p.phone ?? "",
        photo_url: p.photo_url ?? "",
      });
    }
  }, [schoolId]);

  useEffect(() => { load(); loadSchoolStatus(schoolId).then(s => setStatus(s ?? "")); }, [load, schoolId]);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Choisissez une image"); return; }
    setUploading(true);
    const path = `${schoolId}/photo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: true });
    if (error) { toast.error("Échec de l'envoi de la photo"); setUploading(false); return; }
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    setForm(f => ({ ...f, photo_url: data.publicUrl }));
    await supabase.from("profiles").update({ photo_url: data.publicUrl } as any).eq("id", schoolId);
    setUploading(false);
    toast.success("Photo mise à jour");
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form as any).eq("id", schoolId);
    if (!error && status) {
      const r = await saveSchoolStatus(schoolId, status);
      if (!r.db) toast.warning("Statut gardé sur cet appareil : la colonne school_status n'existe pas encore dans la base (migration SQL à exécuter).");
    }
    setSaving(false);
    if (error) { toast.error("Erreur d'enregistrement"); return; }
    await refreshProfile();
    toast.success("Profil enregistré");
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Mon profil</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
        >
          {form.photo_url ? (
            <img src={form.photo_url} alt="Photo de profil" className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
              <ImagePlus className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          <p className="text-sm text-muted-foreground">Glissez-déposez votre photo ici, ou choisissez un fichier.</p>
          <Input type="file" accept="image/*" className="max-w-xs" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          {uploading && <p className="text-xs flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Envoi en cours...</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Nom affiché</Label><Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Nom de l'école</Label><Input value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Classe</Label><Select value={form.class_name} onValueChange={v => setForm(f => ({ ...f, class_name: v }))}><SelectTrigger><SelectValue placeholder="Choisir votre classe" /></SelectTrigger><SelectContent>{RESOURCE_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2">
            <Label>Statut de l'école</Label>
            <Select value={status} onValueChange={v => setStatus(v as SchoolStatus)}>
              <SelectTrigger><SelectValue placeholder="Publique ou privée ?" /></SelectTrigger>
              <SelectContent><SelectItem value="publique">École publique</SelectItem><SelectItem value="privee">École privée</SelectItem></SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Sert à remplir automatiquement la fiche d'inscription au CEP (classe de CM2).</p>
          </div>
          <div className="space-y-2"><Label>Nom de l'enseignant(e)</Label><Input value={form.teacher_name} onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        </div>

        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enregistrer</Button>
      </CardContent>
    </Card>
  );
};

export default SchoolProfile;
