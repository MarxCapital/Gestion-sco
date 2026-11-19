import { supabase } from "@/integrations/supabase/client";

/** Signature à distance : le prestataire envoie un lien, le directeur y fait signer les apprenants. */
export interface LinkStudent { k: string; nom: string; pre: string }
export interface PublicStudent extends LinkStudent { signed: boolean }
export interface PublicLink { school: string; expires_at: string; students: PublicStudent[] }
export interface LinkStatus { active: boolean; expires_at: string; received: number; pending: number }

const rpc = (fn: string, args: Record<string, unknown>) => (supabase.rpc as any)(fn, args) as Promise<{ data: any; error: { message: string } | null }>;
const msg = (e: { message: string }) => /Failed to fetch|NetworkError|Load failed/i.test(e.message) ? "Pas de connexion internet." : e.message;

export const signUrl = (token: string) => `${window.location.origin}/signer/${token}`;

/** Les appels « prestataire » exigent une vraie session. Si elle a expiré (l'écran affiche encore le nom grâce à la copie locale), on tente de la renouveler. */
async function needSession() {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 15000)) {
    try { session = (await supabase.auth.refreshSession()).data.session; } catch { /* */ }
  }
  if (!session) throw new Error("Votre session a expiré : déconnectez-vous puis reconnectez-vous, et réessayez.");
}
const friendly = (e: { message: string }) => /permission denied for function/i.test(e.message)
  ? "Accès refusé par la base de données : reconnectez-vous ; si le message revient, exécutez le SQL « signature_grants » dans Supabase."
  : msg(e);

export async function createLink(scope: string, school: string, students: LinkStudent[]): Promise<string> {
  await needSession();
  const { data, error } = await rpc("sig_link_upsert", { p_scope: scope, p_school: school, p_students: students, p_days: 21 });
  if (error) throw new Error(/function .* does not exist|schema cache/i.test(error.message) ? "La migration SQL « signature_links » n'est pas appliquée." : friendly(error));
  return String(data);
}
export async function linkStatus(token: string): Promise<LinkStatus | null> {
  await needSession();
  const { data, error } = await rpc("sig_status", { p_token: token });
  if (error) throw new Error(msg(error));
  return data ?? null;
}
/** Signatures reçues et pas encore récupérées (PNG en base64, déjà marquées comme importées côté serveur). */
export async function pullSignatures(token: string, all = false): Promise<{ student_key: string; png: string }[]> {
  await needSession();
  const { data, error } = await rpc("sig_pull", { p_token: token, p_all: all });
  if (error) throw new Error(msg(error));
  return (data ?? []) as { student_key: string; png: string }[];
}
export async function revokeLink(token: string) {
  await needSession();
  const { error } = await rpc("sig_revoke", { p_token: token });
  if (error) throw new Error(msg(error));
}
export async function getPublicLink(token: string): Promise<PublicLink | null> {
  const { data, error } = await rpc("sig_link_get", { p_token: token });
  if (error) throw new Error(msg(error));
  return data ?? null;
}
export async function submitSignature(token: string, key: string, png: Blob): Promise<void> {
  const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("Lecture impossible")); r.readAsDataURL(png); });
  const { error } = await rpc("sig_submit", { p_token: token, p_key: key, p_png: dataUrl });
  if (error) throw new Error(msg(error));
}
export const dataUrlToBlob = async (u: string) => (await fetch(u)).blob();

export const linkTokenKey = (scope: string) => `gestionsco.siglink.${scope}`;
export const storedLinkToken = (scope: string) => { try { return localStorage.getItem(linkTokenKey(scope)) || ""; } catch { return ""; } };
/** Supprime sur le serveur la signature reçue par lien (un apprenant, ou toutes si key est vide). Sans effet s'il n'y a pas de lien. */
export async function deleteRemoteSignature(token: string, key?: string): Promise<void> {
  if (!token) return;
  await needSession();
  const { error } = await rpc("sig_delete", { p_token: token, p_key: key ?? null });
  if (error) throw new Error(/function .* does not exist|schema cache/i.test(error.message) ? "Le SQL « sig_delete » n'est pas appliqué dans Supabase." : friendly(error));
}
