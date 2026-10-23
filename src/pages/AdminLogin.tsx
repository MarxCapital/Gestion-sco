import { SUPABASE_URL } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import InstallBanner from "@/components/InstallBanner";
import logoImg from "@/assets/brand";

const AdminLogin = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const { signIn, user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role) {
      const map: Record<string, string> = { admin: "/admin", center: "/centre", csbante: "/csbante" };
      navigate(map[role] || "/", { replace: true });
    }
  }, [user, role, navigate]);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: "Marx",
            password: "247624",
            role: "admin",
            display_name: "Administrateur",
            is_setup: true,
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) {
        if (data.error?.includes("existe déjà")) {
          toast.info("Le compte admin existe déjà. Connectez-vous.");
          setShowSetup(false);
          return;
        }
        throw new Error(data.error);
      }
      toast.success("Compte admin créé ! Connectez-vous avec le mot de passe.");
      setShowSetup(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Veuillez entrer le mot de passe");
      return;
    }
    setLoading(true);
    try {
      await signIn("Marx", password);
      toast.success("Connexion admin réussie");
    } catch (err: any) {
      if (err?.message === "CONCURRENT_SESSION") {
        toast.error("Votre binôme est déjà connecté, vous ne pourrez avoir accès au compte que lorsqu'il sera déconnecté");
      } else {
        toast.error("Mot de passe incorrect");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-destructive/5 via-background to-primary/10">
      <InstallBanner persistent adminMode />
      <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-4 pb-2">
          <img src={logoImg} alt="GestionSco" className="mx-auto w-20 h-20 object-contain" />
          <div>
            <CardTitle className="text-2xl font-bold">Administration</CardTitle>
            <CardDescription className="text-base mt-1">Espace administrateur GestionSco</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">Mot de passe</Label>
              <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" autoFocus />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="w-4 h-4 mr-2" />
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            {showSetup ? (
              <Button variant="outline" size="sm" onClick={handleSetup} disabled={loading}>
                {loading ? "Création..." : "Confirmer l'initialisation"}
              </Button>
            ) : (
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground underline" onClick={() => setShowSetup(true)}>
                Première visite ? Initialiser le compte admin
              </button>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
