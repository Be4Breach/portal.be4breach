import { LayoutDashboard, Shield, BarChart3, AlertTriangle, FileText, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/" },
  { title: "Threats", icon: Shield, path: "/threats" },
  { title: "Analytics", icon: BarChart3, path: "/analytics" },
  { title: "Alerts", icon: AlertTriangle, path: "/alerts" },
  { title: "Reports", icon: FileText, path: "/reports" },
  { title: "Settings", icon: Settings, path: "/settings" },
];

const AppSidebar = () => {
  return (
    <aside className="w-56 shrink-0 border-r bg-card hidden lg:flex flex-col">

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
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
      </nav>
      <div className="p-4 border-t">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
          Protected by be<span className="text-destructive">4</span>breach
        </p>
      </div>
    </aside>
  );
};

export default AppSidebar;
