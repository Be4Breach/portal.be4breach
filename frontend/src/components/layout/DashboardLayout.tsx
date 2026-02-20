import { useState } from "react";
import { Outlet } from "react-router-dom";
import TopNav from "./TopNav";
import AppSidebar, { MobileDrawer } from "./AppSidebar";

const DashboardLayout = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col">

      {/* Navbar — passes the toggle so the hamburger can be in the top bar */}
      <div className="shrink-0">
        <TopNav onMobileMenuClick={() => setMobileNavOpen(true)} />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Desktop sidebar */}
        <AppSidebar />

        {/* Mobile slide-in drawer */}
        <MobileDrawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto p-6 bg-background">
          <Outlet />
        </main>

      </div>
    </div>
  );
};

export default DashboardLayout;
