import { Toaster } from "@/components/ui/sonner";
import NetworkStatusBar from "@/components/NetworkStatusBar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { SchoolYearProvider } from "@/contexts/SchoolYearContext";
import YearGate from "@/components/YearGate";
import MaintenanceGate from "@/components/MaintenanceGate";
import Login from "@/pages/Login";
import AdminLogin from "@/pages/AdminLogin";
import ChangePassword from "@/pages/ChangePassword";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import CenterDashboard from "@/pages/center/CenterDashboard";
import CsbanteDashboard from "@/pages/csbante/CsbanteDashboard";
import IndependentDashboard from "@/pages/independent/IndependentDashboard";
import SchoolDashboard from "@/pages/school/SchoolDashboard";
import NotFound from "@/pages/NotFound";
import Resultats from "@/pages/Resultats";
import Index from "@/pages/Index";

const queryClient = new QueryClient();

const AuthRedirect = () => {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const redirectMap: Record<string, string> = {
    admin: "/admin",
    center: "/centre",
    csbante: "/csbante",
    independent: "/independant",
    school: "/ecole",
  };
  return <Navigate to={redirectMap[role || "center"] || "/login"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <NetworkStatusBar />
      <BrowserRouter>
        <AuthProvider>
          <SchoolYearProvider>
          <MaintenanceGate>
          <YearGate>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/Marx" element={<AdminLogin />} />
            <Route path="/changer-mot-de-passe" element={<ChangePassword />} />
            <Route path="/resultats" element={<Resultats />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/centre"
              element={
                <ProtectedRoute allowedRoles={["center"]}>
                  <CenterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/csbante"
              element={
                <ProtectedRoute allowedRoles={["csbante"]}>
                  <CsbanteDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/independant"
              element={
                <ProtectedRoute allowedRoles={["independent"]}>
                  <IndependentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ecole"
              element={
                <ProtectedRoute allowedRoles={["school"]}>
                  <SchoolDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </YearGate>
          </MaintenanceGate>
          </SchoolYearProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
