import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Non autorisé");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Seul l'admin peut effectuer cette action");

    const { scope, confirm } = await req.json();
    if (confirm !== "SUPPRIMER") {
      throw new Error("Confirmation requise");
    }
    if (scope !== "linked" && scope !== "independent") {
      throw new Error("Scope invalide");
    }

    // Identifier les centres concernés selon le scope
    const { data: indepRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "independent");
    const indepIds = (indepRoles ?? []).map((r: any) => r.user_id);

    let candidateIds: string[] = [];
    if (scope === "independent") {
      if (indepIds.length === 0) {
        return new Response(JSON.stringify({ success: true, deleted: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: cands } = await supabaseAdmin
        .from("candidates")
        .select("id")
        .in("center_id", indepIds);
      candidateIds = (cands ?? []).map((c: any) => c.id);
    } else {
      // linked => tous les candidats sauf ceux des centres independent
      let query = supabaseAdmin.from("candidates").select("id, center_id");
      const { data: allCands } = await query;
      if (indepIds.length > 0) {
        candidateIds = (allCands ?? [])
          .filter((c: any) => !indepIds.includes(c.center_id))
          .map((c: any) => c.id);
      } else {
        candidateIds = (allCands ?? []).map((c: any) => c.id);
      }
    }

    if (candidateIds.length === 0) {
      return new Response(JSON.stringify({ success: true, deleted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supprimer en lots de 500 pour éviter URL trop longue
    let deleted = 0;
    const chunkSize = 500;
    for (let i = 0; i < candidateIds.length; i += chunkSize) {
      const slice = candidateIds.slice(i, i + chunkSize);
      const { error, count } = await supabaseAdmin
        .from("notes")
        .delete({ count: "exact" })
        .in("candidate_id", slice);
      if (error) throw error;
      deleted += count ?? 0;
    }

    return new Response(JSON.stringify({ success: true, deleted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-all-notes error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
