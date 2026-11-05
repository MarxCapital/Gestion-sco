import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminMode } from "@/lib/app-mode";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to={isAdminMode ? "/Marx" : "/login"} replace />;

  if (profile?.must_change_password) return <Navigate to="/changer-mot-de-passe" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const redirectMap: Record<string, string> = {
      admin: "/admin",
      center: "/centre",
      csbante: "/csbante",
      independent: "/independant",
      school: "/ecole",
      prestataire: "/prestataire",
    };
    return <Navigate to={redirectMap[role] || "/login"} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
