import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Index from "@/pages/Index";
import Alerts from "@/pages/Alerts";
import Threats from "@/pages/Threats";
import Analytics from "@/pages/Analytics";
import Reports from "@/pages/Reports";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AdminDashboard from "@/pages/AdminDashboard";
import { Toaster } from "react-hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";

const ProtectedRoute = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

function App() {
  return (
    <TooltipProvider>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />

          <Route element={<DashboardLayout />}>
            <Route index element={<Index />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="threats" element={<Threats />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  );
}

export default App;
