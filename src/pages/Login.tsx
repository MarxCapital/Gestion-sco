import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import logoImg from "@/assets/brand";
import TricolorBar from "@/components/portal/TricolorBar";

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role) {
      const map: Record<string, string> = { admin: "/admin", center: "/centre", csbante: "/csbante", independent: "/independant" };
      navigate(map[role] || "/", { replace: true });
    }
  }, [user, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
      toast.success("Connexion réussie");
    } catch (err: any) {
      if (err?.message === "CONCURRENT_SESSION") {
        toast.error("Votre binôme est déjà connecté, vous ne pourrez avoir accès au compte que lorsqu'il sera déconnecté");
      } else {
        toast.error("Identifiant ou mot de passe incorrect");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-sidebar-foreground/85 transition-colors hover:text-sidebar-foreground">
          <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
        </Link>
        <Card className="border-0 shadow-soft">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="mx-auto w-20 h-20">
              <img src={logoImg} alt="GestionSco" className="w-full h-full object-contain" />
            </div>
            <div>
               <CardTitle className="font-heading text-2xl font-bold text-sidebar">Connexion</CardTitle>
               <TricolorBar centered className="my-3" />
              <CardDescription className="text-base mt-1">Connexion à la plateforme</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                 <Label htmlFor="identifier">Identifiant <span className="text-destructive">*</span></Label>
                <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Entrez votre identifiant" autoComplete="username" />
              </div>
              <div className="space-y-2">
                 <Label htmlFor="password">Mot de passe <span className="text-destructive">*</span></Label>
                 <div className="relative"><Input id="password" className="pr-11" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 text-muted-foreground" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? <EyeOff /> : <Eye />}</Button></div>
              </div>
               <p className="text-xs text-muted-foreground">* Champs obligatoires</p>
              <Button type="submit" className="w-full" disabled={loading}>
                 {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
                 {loading ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
