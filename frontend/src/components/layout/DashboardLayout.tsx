import { Outlet } from "react-router-dom";
import TopNav from "./TopNav";
import AppSidebar from "./AppSidebar";

const DashboardLayout = () => {
  return (
    <div className="h-screen flex flex-col">
      
      {/* Navbar */}
      <div className="shrink-0">
        <TopNav />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <AppSidebar />

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto p-6 bg-background">
          <Outlet />
        </main>

      </div>
    </div>
  );
};

export default DashboardLayout;
