import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminMode, ADMIN_LOGIN, CHANGE_PASSWORD_PATH, ROLE_HOME } from "@/lib/app-mode";

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

  if (!user) return <Navigate to={isAdminMode ? ADMIN_LOGIN : "/login"} replace />;

  if (profile?.must_change_password) return <Navigate to={CHANGE_PASSWORD_PATH} replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const redirectMap: Record<string, string> = {
      admin: ROLE_HOME.admin,
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
