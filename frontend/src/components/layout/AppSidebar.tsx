import {
  LayoutDashboard,
  Shield,
  FileText,
  Settings,
  X,
  UserCog,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  Package,
  Code2,
  Globe,
  Layers,
  Github,
  Radar,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// ─── DevSecOps sub-items ──────────────────────────────────────────────────────

const devSecOpsItems = [
  { title: "Overview", icon: Shield, path: "/devsecops", exact: true },
  { title: "Repositories", icon: Github, path: "/devsecops/repositories" },
  { title: "SCA", icon: Package, path: "/devsecops/sca" },
  { title: "SAST", icon: Code2, path: "/devsecops/sast" },
  { title: "DAST", icon: Globe, path: "/devsecops/dast" },
  { title: "SBOM", icon: Layers, path: "/devsecops/sbom" },
];

// ─── Shared link style ────────────────────────────────────────────────────────

const linkBase =
  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors";
const linkActive = "bg-secondary text-foreground border-l-2 border-destructive";
const linkInactive = "text-muted-foreground hover:text-foreground hover:bg-secondary/50";

// ─── DevSecOps accordion nav ──────────────────────────────────────────────────

function DevSecOpsNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const isInSection = location.pathname.startsWith("/devsecops");
  const [open, setOpen] = useState(isInSection);

  return (
    <div>
      {/* Accordion trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          linkBase, "w-full justify-between",
          isInSection ? linkActive : linkInactive
        )}
      >
        <span className="flex items-center gap-3">
          <Radar className="h-4 w-4 shrink-0" />
          DevSecOps
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Sub-items */}
      {open && (
        <div className="pl-4 mt-1 space-y-0.5 border-l border-border/50 ml-5">
          {devSecOpsItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.path
              : location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shared nav link list ─────────────────────────────────────────────────────
function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <nav className="flex-1 py-4 px-3 space-y-1">
      {/* Dashboard */}
      <NavLink
        to="/"
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(linkBase, isActive ? linkActive : linkInactive)
        }
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        <span>Dashboard</span>
      </NavLink>

      {/* Identity Risk Intelligence */}
      <NavLink
        to="/identity-analyzer"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(linkBase, isActive ? linkActive : linkInactive)
        }
      >
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>Identity Analyzer</span>
      </NavLink>

      {/* Compliance */}
      <NavLink
        to="/compliance"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(linkBase, isActive ? linkActive : linkInactive)
        }
      >
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>Compliance</span>
      </NavLink>

      {/* ── DevSecOps accordion ── */}
      <div className="pt-1 pb-1">

        <DevSecOpsNav onNavigate={onNavigate} />
      </div>

      {/* Reports */}
      <NavLink
        to="/reports"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(linkBase, isActive ? linkActive : linkInactive)
        }
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span>Reports</span>
      </NavLink>

      {/* Threats */}
      <NavLink
        to="/threats"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(linkBase, isActive ? linkActive : linkInactive)
        }
      >
        <Shield className="h-4 w-4 shrink-0" />
        <span>Threats</span>
      </NavLink>

      {/* Settings */}
      <NavLink
        to="/settings"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(linkBase, isActive ? linkActive : linkInactive)
        }
      >
        <Settings className="h-4 w-4 shrink-0" />
        <span>Settings</span>
      </NavLink>

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
              cn(linkBase, isActive ? linkActive : linkInactive)
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

// ─── Desktop sidebar ──────────────────────────────────────────────────────────
const AppSidebar = () => {
  return (
    <aside className="w-56 shrink-0 border-r bg-card hidden lg:flex flex-col overflow-y-auto">
      <NavItems />
      <SidebarFooter />
    </aside>
  );
};

export default AppSidebar;
