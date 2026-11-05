import { useCallback, useEffect, useState } from "react";
import { sdb } from "@/lib/school-db";
import { toISODate } from "@/lib/school";

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
}

/** Crée la notification si elle n'existe pas déjà (déduplication par titre + jour). */
async function ensureNotification(userId: string, title: string, body: string, kind: string) {
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const { data } = await sdb("notifications").select("id")
    .eq("user_id", userId).eq("title", title).gte("created_at", since.toISOString()).limit(1);
  if (data && data.length > 0) return;
  await sdb("notifications").insert({ user_id: userId, title, body, kind });
}

/**
 * Notifications internes + rappels de l'enseignant :
 *  - salutation quotidienne à partir de 07h00 (heure du Bénin, GMT+1)
 *  - rappel si l'appel du jour n'a pas encore été fait
 *  - alerte quand la statistique du mois précédent est disponible
 */
export function useNotifications(userId?: string, role?: string | null) {
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await sdb("notifications").select("*")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
    setItems((data || []) as AppNotification[]);
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await sdb("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    load();
  }, [userId, load]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const run = async () => {
      if (role === "school") {
        // Heure du Bénin (UTC+1)
        const beninNow = new Date(Date.now() + (60 + new Date().getTimezoneOffset()) * 60000);
        const today = toISODate(beninNow);

        if (beninNow.getHours() >= 7) {
          await ensureNotification(
            userId,
            "Bonjour et bonne journée !",
            "N'oubliez pas de marquer la présence de vos apprenants une fois à l'école.",
            "reminder",
          );

          const { data: sessions } = await sdb("attendance_sessions")
            .select("half_day").eq("school_id", userId).eq("session_date", today);
          if (!sessions || sessions.length === 0) {
            await ensureNotification(userId, "Appel du jour non marqué",
              "La présence des apprenants n'a pas encore été enregistrée aujourd'hui.", "warning");
          }
        }

        // Statistique du mois précédent disponible dès le 1er du mois
        if (beninNow.getDate() <= 3) {
          const prev = new Date(beninNow.getFullYear(), beninNow.getMonth() - 1, 1);
          const label = prev.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
          await ensureNotification(userId, `Statistique du mois de ${label} disponible`,
            "Consultez la rubrique Statistiques de la classe pour renseigner votre registre d'appel.", "info");
        }
      }
      if (!cancelled) load();
    };

    run();
    const timer = setInterval(run, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [userId, role, load]);

  const unread = items.filter(i => !i.read_at).length;
  return { notifications: items, unread, markAllRead, reload: load };
}
