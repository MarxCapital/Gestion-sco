import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { search_type, numero_table, nom, prenoms } = await req.json();

    // Fetch all candidates with notes using pagination to bypass 1000-row limit
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("candidates")
        .select("*, notes(*)")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // Find the candidate
    let found: any;
    if (search_type === "numero") {
      found = allData?.find((c: any) => c.numero_table?.trim().toLowerCase() === numero_table?.trim().toLowerCase());
    } else {
      found = allData?.find((c: any) =>
        c.nom?.trim().toLowerCase() === nom?.trim().toLowerCase() &&
        (c.prenoms || '').trim().toLowerCase() === (prenoms || '').trim().toLowerCase()
      );
    }

    if (!found) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute global ranking
    const SUBJECTS = ['dictee', 'expression_ecrite', 'lecture', 'es', 'est', 'mathematique', 'ea_dessin', 'ea_poesie', 'eps'];
    
    // notes comes as an array from the join; extract first element
    const foundNotes = Array.isArray(found.notes) ? found.notes[0] || null : found.notes || null;
    const hasNotes = foundNotes && SUBJECTS.some(s => foundNotes[s] !== null && foundNotes[s] !== undefined);

    const computeForList = (list: any[]) => {
      const results = list.map((c: any) => {
        const n = Array.isArray(c.notes) ? c.notes[0] || null : c.notes || null;
        if (c.is_absent || !n) return { ...c, total: null, moyenne: null, rang: null, seuilAtteint: false };
        const values = SUBJECTS.map(s => n[s] as number | null);
        const total = values.every(v => v === null) ? null : values.reduce((sum, v) => sum! + (v ?? 0), 0);
        const moyenne = total !== null ? Math.round((total / 18) * 100) / 100 : null;
        const seuilAtteint = SUBJECTS.filter(s => n[s] !== null && n[s] >= 10).length >= 6;
        return { ...c, total, moyenne, rang: null, seuilAtteint };
      });

      const ranked = results.filter(r => !r.is_absent && r.moyenne !== null)
        .sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));
      let currentRank = 1;
      for (let i = 0; i < ranked.length; i++) {
        if (i > 0 && ranked[i].moyenne !== ranked[i - 1].moyenne) currentRank = i + 1;
        ranked[i].rang = currentRank;
      }
      return results.map(r => {
        const f = ranked.find(x => x.id === r.id);
        return f ? { ...r, rang: f.rang } : r;
      });
    };

    const allComputed = computeForList(allData || []);
    const globalResult = allComputed.find((c: any) => c.id === found.id);

    // Center ranking
    const centerCandidates = (allData || []).filter((c: any) => c.center_id === found.center_id);
    const centerComputed = computeForList(centerCandidates);
    const centerResult = centerComputed.find((c: any) => c.id === found.id);

    // Only return necessary data (not all candidates)
    const SUBJECT_LABELS: Record<string, string> = {
      dictee: 'Dictée', expression_ecrite: 'Expr. écrite', lecture: 'Lecture',
      es: 'ES', est: 'EST', mathematique: 'Math.',
      ea_dessin: 'EA COUTURE', ea_poesie: 'EA Poésie', eps: 'EPS'
    };

    const notes = Object.fromEntries(
      SUBJECTS.map(s => [SUBJECT_LABELS[s], foundNotes ? foundNotes[s] : null])
    );

    return new Response(JSON.stringify({
      found: true,
      candidate: {
        nom: found.nom,
        prenoms: found.prenoms,
        sexe: found.sexe,
        ecole_provenance: found.ecole_provenance,
        is_absent: found.is_absent,
        has_notes: hasNotes,
        notes,
        total: globalResult?.total,
        moyenne: globalResult?.moyenne,
        rang_centre: centerResult?.rang,
        rang_global: globalResult?.rang,
        seuilAtteint: globalResult?.seuilAtteint,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lookup-result error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
