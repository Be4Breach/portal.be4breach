import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search, Settings, X, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import navLogo from "@/assets/logo.jpeg";
import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const severityStyles: Record<string, string> = {
  Critical: "bg-destructive text-destructive-foreground",
  High: "bg-threat-high text-white",
  Medium: "bg-threat-medium text-white",
  Low: "bg-threat-low text-white",
};

const TopNav = ({ onMobileMenuClick }: { onMobileMenuClick?: () => void }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const { data } = useDashboardData();
  const { user, logout } = useAuth();

  const notifications = (data?.recentAlerts ?? []).slice(0, 3);

  // Generate initials from name or email
  const getInitials = () => {
    if (user?.github_name) {
      const parts = user.github_name.split(" ");
      return parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : user.github_name.substring(0, 2).toUpperCase();
    }
    if (user?.email) return user.email.substring(0, 2).toUpperCase();
    return "U";
  };

  const getDisplayName = () => user?.github_name || user?.github_login || user?.email?.split("@")[0] || "User";

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && search.trim()) {
      navigate(`/threats?q=${encodeURIComponent(search.trim())}`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 h-14 border-b bg-card flex items-center justify-between px-4 md:px-6 shrink-0 gap-3">
      {/* Hamburger — mobile only */}
      <button
        id="mobile-menu-btn"
        onClick={onMobileMenuClick}
        className="lg:hidden flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button onClick={() => navigate("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
        <span className="text-xl font-bold tracking-tight">
          <img src={navLogo} alt="Logo" className="w-[120px] md:w-[150px]" />
        </span>
      </button>

      <div className="hidden md:flex items-center w-full max-w-sm mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search threats..."
            className="pl-9 h-9 bg-secondary border-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearch}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <button className="relative text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                {notifications.length}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b">
              <p className="text-sm font-semibold">Notifications</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setNotifOpen(false); navigate("/alerts"); }}
                  className="w-full text-left p-3 hover:bg-secondary/50 transition-colors border-b last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{n.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                    <Badge className={cn("text-[9px] shrink-0 scale-90", severityStyles[n.severity])}>
                      {n.severity}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => { setNotifOpen(false); navigate("/alerts"); }}
              className="w-full p-2 text-xs text-destructive hover:bg-secondary/50 font-medium transition-colors"
            >
              View all alerts
            </button>
          </PopoverContent>
        </Popover>

        <button
          onClick={() => navigate("/settings")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="h-5 w-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-8 w-8 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium hover:opacity-80 transition-opacity border border-border">
              {user?.github_avatar ? (
                <img src={user.github_avatar} alt={getDisplayName()} className="h-full w-full object-cover" />
              ) : (
                getInitials()
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{getDisplayName()}</p>
              <p className="text-xs text-muted-foreground">{user?.email || "user@be4breach.com"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>Profile Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/reports")}>My Reports</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default TopNav;
