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

    const { identifier, password, role, display_name, is_setup } = await req.json();

    if (!identifier || !password || !role) {
      return new Response(JSON.stringify({ error: "identifier, password et role sont requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For initial admin setup - no auth required
    if (is_setup && role === "admin") {
      const { data: existingAdmin } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("role", "admin")
        .limit(1);

      if (existingAdmin && existingAdmin.length > 0) {
        return new Response(JSON.stringify({ error: "Le compte admin existe déjà" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Verify caller is admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Non autorisé");

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) throw new Error("Non autorisé");

      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) throw new Error("Seul l'admin peut créer des comptes");
    }

    const ROLES = ["admin", "center", "csbante", "independent", "school", "prestataire"];
    if (!ROLES.includes(role)) throw new Error("Type de compte inconnu");

    const email = `${identifier.toLowerCase().replace(/\s+/g, "")}@gestionsco.app`;

    // Try to create the auth user
    let userId: string;
    let createdNow = false;
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { identifier, display_name: display_name || identifier },
    });

    if (createError) {
      // If user already exists in auth but has no profile/role (orphaned), reuse it
      if (createError.message?.includes("already been registered")) {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;
        const existingUser = users?.find((u: any) => u.email === email);
        if (!existingUser) throw new Error("Utilisateur introuvable");

        // Check if profile exists
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", existingUser.id)
          .maybeSingle();

        if (existingProfile) {
          // Un compte complet (profil + rôle) existe déjà : refus. Un profil SANS rôle vient d'une création
          // interrompue : on le répare au lieu de bloquer l'identifiant.
          const { data: existingRole } = await supabaseAdmin
            .from("user_roles").select("id").eq("user_id", existingUser.id).limit(1);
          if (existingRole && existingRole.length > 0) {
            throw new Error("Un compte avec cet identifiant existe déjà");
          }
          await supabaseAdmin.from("profiles").delete().eq("id", existingUser.id);
        }

        // Orphaned auth user - update password and reuse
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: { identifier, display_name: display_name || identifier },
        });
        userId = existingUser.id;
      } else {
        throw createError;
      }
    } else {
      userId = newUser.user.id;
      createdNow = true;
    }

    // En cas d'échec après la création du compte d'accès, on défait tout pour ne laisser aucun compte à moitié créé.
    const rollback = async () => {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      if (createdNow) await supabaseAdmin.auth.admin.deleteUser(userId);
    };

    // Insert profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      identifier,
      display_name: display_name || identifier,
      must_change_password: role !== "admin",
      generated_password: password,
    });
    if (profileError) { await rollback(); throw profileError; }

    // Insert role
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role,
    });
    if (roleError) {
      await rollback();
      if (/invalid input value for enum/i.test(roleError.message || "")) {
        throw new Error(`Le type de compte « ${role} » n'est pas encore activé dans la base de données. Exécutez la migration SQL des rôles (ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS '${role}';) dans Supabase, puis réessayez.`);
      }
      throw roleError;
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-user error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
