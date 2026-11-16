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

    const { confirm } = await req.json();
    if (confirm !== "SUPPRIMER") throw new Error("Confirmation requise");

    // Récupérer tous les candidats actuellement marqués absents (par lots)
    const PAGE = 1000;
    let from = 0;
    let ids: string[] = [];
    while (true) {
      const { data, error } = await supabaseAdmin
        .from("candidates")
        .select("id")
        .eq("is_absent", true)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const chunk = (data ?? []).map((c: any) => c.id);
      ids = ids.concat(chunk);
      if (chunk.length < PAGE) break;
      from += PAGE;
    }

    if (ids.length === 0) {
      return new Response(JSON.stringify({ success: true, cleared: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let cleared = 0;
    const chunkSize = 500;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const slice = ids.slice(i, i + chunkSize);
      const { error, count } = await supabaseAdmin
        .from("candidates")
        .update({ is_absent: false }, { count: "exact" })
        .in("id", slice);
      if (error) throw error;
      cleared += count ?? 0;
    }

    return new Response(JSON.stringify({ success: true, cleared }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clear-all-absences error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
