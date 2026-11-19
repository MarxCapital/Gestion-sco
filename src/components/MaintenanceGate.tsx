import { useAppSettings } from "@/hooks/use-app-settings";
import { useAuth } from "@/contexts/AuthContext";
import { Wrench, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/brand";

interface Props {
  children: React.ReactNode;
}

const MaintenanceGate = ({ children }: Props) => {
  const { settings, textSettings, loading } = useAppSettings();
  const { role, signOut, user } = useAuth();

  if (loading) return <>{children}</>;

  // La maintenance ne s'applique qu'à un utilisateur CONNECTÉ avec un rôle.
  // Les pages publiques (accueil, /login, /Marx, /resultats) restent toujours accessibles.
  // L'admin n'est jamais affecté par la maintenance.
  const isMaintenance =
    !!user &&
    !!role &&
    role !== "admin" &&
    ((role === "independent" && settings.maintenance_mode_independent) ||
      (role !== "independent" && settings.maintenance_mode));

  if (isMaintenance) {
    const email = textSettings.maintenance_contact_email?.trim();
    const phone = textSettings.maintenance_contact_phone?.trim();
    const message =
      textSettings.maintenance_message?.trim() ||
      "GestionSco est temporairement indisponible. Merci de revenir dans quelques instants.";

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <img src={logoImg} alt="GestionSco" className="w-24 h-24 mx-auto object-contain" />
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold">Plateforme en maintenance</h1>
            <p className="text-muted-foreground whitespace-pre-line">{message}</p>
          </div>

          {(email || phone) && (
            <div className="border rounded-lg p-4 bg-card space-y-2 text-left">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
                Contacter le support
              </p>
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="break-all">{email}</span>
                </a>
              )}
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s+/g, "")}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{phone}</span>
                </a>
              )}
            </div>
          )}

          {user && (
            <Button variant="outline" onClick={signOut}>
              Se déconnecter
            </Button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MaintenanceGate;
