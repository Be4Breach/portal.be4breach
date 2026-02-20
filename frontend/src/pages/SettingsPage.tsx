import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Settings, Github, CheckCircle2, AlertTriangle, Loader2,
  User, Mail, Shield,
} from "lucide-react";

import BACKEND_URL from "@/lib/api";

export default function SettingsPage() {
  const { user, token, hasGitHub } = useAuth();
  const [params] = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const [successBanner, setSuccessBanner] = useState(params.get("github_connected") === "1");
  const [errorBanner] = useState(params.get("github_error") ?? null);

  // Auto-dismiss success banner after 5s
  useEffect(() => {
    if (!successBanner) return;
    const t = setTimeout(() => setSuccessBanner(false), 5000);
    return () => clearTimeout(t);
  }, [successBanner]);

  const handleConnectGitHub = () => {
    setConnecting(true);
    window.location.href = `${BACKEND_URL}/api/github/connect?auth_token=${token}`;
  };

  const displayName = user
    ? user.github_name || `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email
    : "";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and integrations.</p>
      </div>

      {/* Success banner */}
      {successBanner && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          GitHub account connected successfully! You can now scan your repositories.
        </div>
      )}

      {/* Error banner */}
      {errorBanner && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          GitHub connection failed: {decodeURIComponent(errorBanner)}
        </div>
      )}

      {/* Profile card */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          {user?.github_avatar ? (
            <img src={user.github_avatar} alt={displayName} className="h-12 w-12 rounded-full object-cover border" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
          )}
          <div>
            <p className="font-semibold">{displayName}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="grid gap-3">
          <InfoRow icon={Mail} label="Email" value={user?.email ?? "—"} />
          <InfoRow icon={Shield} label="Role" value={user?.role ?? "user"} />
          <InfoRow
            icon={Settings}
            label="Auth provider"
            value={user?.auth_provider === "github" ? "GitHub OAuth" : "Email / Password"}
          />
          {user?.first_name && (
            <InfoRow
              icon={User}
              label="Name"
              value={`${user.first_name} ${user.last_name ?? ""}`.trim()}
            />
          )}
        </div>
      </div>

      {/* GitHub integration card */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          <h2 className="font-semibold">GitHub Integration</h2>
        </div>

        {hasGitHub ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Connected as <span className="font-mono font-medium">@{user?.github_login}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your GitHub account is linked. You can scan any repository you have access to.
            </p>
            {user?.auth_provider === "email" && (
              <button
                id="reconnect-github-btn"
                onClick={handleConnectGitHub}
                disabled={connecting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                Reconnect GitHub
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your GitHub account to scan repositories for security vulnerabilities.
            </p>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>GitHub is not connected. You won't be able to scan repositories until you connect.</span>
            </div>
            <button
              id="connect-github-btn"
              onClick={handleConnectGitHub}
              disabled={connecting}
              className="flex items-center gap-2 h-10 px-5 rounded-lg bg-[#24292e] hover:bg-[#2f363d] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
              Connect GitHub
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
