import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - npm import for Deno
import pdf from "npm:pdf-parse@1.1.1";
import { parseCandidatePages, type TextItem } from "./parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const contentType = req.headers.get("content-type") || "";
    let pdfBuffer: ArrayBuffer;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) throw new Error("Fichier PDF requis");
      pdfBuffer = await file.arrayBuffer();
    } else {
      const { file_base64 } = await req.json();
      if (!file_base64) throw new Error("file_base64 requis");
      const binaryStr = atob(file_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      pdfBuffer = bytes.buffer;
    }

    // On récupère, page par page, chaque fragment de texte avec sa position (x, y).
    const pages: TextItem[][] = [];
    const pagerender = async (pageData: any) => {
      const content = await pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: true });
      pages.push(
        content.items.map((it: any) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width }))
      );
      return "";
    };
    await pdf(new Uint8Array(pdfBuffer), { pagerender });

    const totalChars = pages.reduce((n, p) => n + p.reduce((m, it) => m + it.str.trim().length, 0), 0);
    if (totalChars === 0) {
      throw new Error(
        "Aucun texte n'a pu être extrait du PDF. Le fichier est peut-être scanné (image). Veuillez utiliser un PDF avec du texte sélectionnable."
      );
    }

    const { candidates, warnings } = parseCandidatePages(pages);
    if (candidates.length === 0) throw new Error(warnings[0] || "Aucun candidat reconnu dans ce PDF.");

    return new Response(JSON.stringify({ candidates, warnings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-candidates error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
