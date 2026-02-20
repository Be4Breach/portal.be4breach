import { LayoutDashboard, Shield, BarChart3, AlertTriangle, FileText, Settings, Github, X, UserCog } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/" },
  { title: "Repositories", icon: Github, path: "/repositories" },
  { title: "Threats", icon: Shield, path: "/threats" },
  { title: "Analytics", icon: BarChart3, path: "/analytics" },
  { title: "Alerts", icon: AlertTriangle, path: "/alerts" },
  { title: "Reports", icon: FileText, path: "/reports" },
  { title: "Settings", icon: Settings, path: "/settings" },
];

// ─── Shared nav link list ─────────────────────────────────────────────────────
function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <nav className="flex-1 py-4 px-3 space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-secondary text-foreground border-l-2 border-destructive"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.title}</span>
        </NavLink>
      ))}

      {/* Admin-only link */}
      {isAdmin && (
        <>
          <div className="pt-2 pb-1 px-3">
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">Admin</p>
          </div>
          <NavLink
            to="/admin"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-foreground border-l-2 border-destructive"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )
            }
          >
            <UserCog className="h-4 w-4 shrink-0" />
            <span>Admin Console</span>
          </NavLink>
        </>
      )}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="p-4 border-t">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
        Protected by be<span className="text-destructive">4</span>breach
      </p>
    </div>
  );
}

// ─── Mobile slide-in drawer ───────────────────────────────────────────────────
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Slide-in panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r shadow-2xl",
          "flex flex-col transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-14 border-b shrink-0">
          <span className="text-sm font-semibold tracking-tight">Navigation</span>
          <button
            id="mobile-menu-close-btn"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <NavItems onNavigate={onClose} />
        <SidebarFooter />
      </aside>
    </>
  );
}

// ─── Desktop sidebar (unchanged) ─────────────────────────────────────────────
const AppSidebar = () => {
  return (
    <aside className="w-56 shrink-0 border-r bg-card hidden lg:flex flex-col">
      <NavItems />
      <SidebarFooter />
    </aside>
  );
};

export default AppSidebar;
