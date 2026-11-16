import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Non autorisé");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Seul l'admin peut supprimer des comptes");

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id requis");

    // Données d'un compte école ou prestataire : on les retire d'abord (chaque suppression est facultative,
    // une table absente ou sans cette colonne ne doit jamais empêcher la suppression du compte).
    const tryDel = async (table: string, col: string) => { try { await supabaseAdmin.from(table).delete().eq(col, user_id); } catch { /* ignore */ } };
    for (const t of ["student_notes", "attendance_absences", "attendance_sessions", "students"]) await tryDel(t, "school_id");
    await tryDel("notifications", "user_id");
    await tryDel("signature_links", "owner");

    // Delete profile and role (cascade will handle candidates)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    await supabaseAdmin.from("candidates").delete().eq("center_id", user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", user_id);
    
    // Delete auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-user error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
