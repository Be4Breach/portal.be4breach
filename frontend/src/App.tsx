import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import Index from "@/pages/Index";
import Alerts from "@/pages/Alerts";
import Threats from "@/pages/Threats";
import Analytics from "@/pages/Analytics";
import Reports from "@/pages/Reports";
import SettingsPage from "@/pages/SettingsPage";
import ScanPage from "@/pages/ScanPage";
import AdminDashboard from "@/pages/AdminDashboard";
import IdentityRiskPage from "@/pages/IdentityRiskPage";
import NotFound from "@/pages/NotFound";
import Compliance from "@/pages/Compliance";
import DevSecOpsDashboard from "@/pages/DevSecOpsDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Admin — standalone layout (own header, no sidebar) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected routes — wrapped in DashboardLayout */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Index />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="threats" element={<Threats />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="reports" element={<Reports />} />
            <Route path="compliance" element={<Compliance />} />
            <Route path="identity-risk-intelligence" element={<IdentityRiskPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="scan/:owner/:repo" element={<ScanPage />} />
            {/* DevSecOps routes */}
            <Route path="devsecops" element={<DevSecOpsDashboard defaultTab="overview" />} />
            <Route path="devsecops/repositories" element={<DevSecOpsDashboard defaultTab="repositories" />} />
            <Route path="devsecops/sca" element={<DevSecOpsDashboard defaultTab="sca" />} />
            <Route path="devsecops/sast" element={<DevSecOpsDashboard defaultTab="sast" />} />
            <Route path="devsecops/dast" element={<DevSecOpsDashboard defaultTab="dast" />} />
            <Route path="devsecops/sbom" element={<DevSecOpsDashboard defaultTab="sbom" />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
