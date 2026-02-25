import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
    Shield,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Info,
    Package,
    Search,
    Zap,
    Activity,
    TrendingDown,
    TrendingUp,
    FileText,
    Globe,
    Lock,
    ExternalLink,
    RefreshCw,
    ChevronRight,
    Bug,
    Code2,
    Database,
    Layers,
    Clock,
    BarChart3,
    Target,
    ArrowUpRight,
    Cpu,
    Github,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import BACKEND_URL from "@/lib/api";
import RepositoriesPage from "@/pages/RepositoriesPage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeveritySummary {
    CRITICAL: number;
    ERROR: number;
    WARNING: number;
    INFO: number;
}

interface LatestScan {
    id: string;
    repo_full_name: string;
    status: "queued" | "running" | "completed" | "failed";
    finding_count: number;
    severity_summary: SeveritySummary;
    created_at: string | null;
    completed_at: string | null;
}

interface Repo {
    id: number;
    name: string;
    full_name: string;
    language: string | null;
    private: boolean;
    updated_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

function scoreColor(score: number) {
    if (score >= 80) return { text: "text-emerald-500", bg: "bg-emerald-500", ring: "stroke-emerald-500", label: "Good" };
    if (score >= 60) return { text: "text-yellow-500", bg: "bg-yellow-500", ring: "stroke-yellow-500", label: "Fair" };
    if (score >= 40) return { text: "text-orange-500", bg: "bg-orange-500", ring: "stroke-orange-500", label: "Poor" };
    return { text: "text-red-500", bg: "bg-red-500", ring: "stroke-red-500", label: "Critical" };
}

// ─── Score Ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
    const r = 30;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const color = scoreColor(score);
    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="-rotate-90" width={size} height={size} viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                <circle
                    cx="40" cy="40" r={r} fill="none"
                    stroke="currentColor" strokeWidth="6"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={`transition-all duration-700 ${color.ring}`}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-lg font-bold leading-none ${color.text}`}>{score}</span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-wide">{color.label}</span>
            </div>
        </div>
    );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
    title, value, sub, icon: Icon, iconCls, trend, trendUp
}: {
    title: string; value: string | number; sub?: string;
    icon: React.ElementType; iconCls: string; trend?: string; trendUp?: boolean;
}) {
    return (
        <div className="rounded-xl border bg-card p-5 space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", iconCls)}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div>
                <p className="text-2xl font-bold">{value}</p>
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
            {trend && (
                <div className={cn("flex items-center gap-1 text-xs font-medium", trendUp ? "text-emerald-500" : "text-red-500")}>
                    {trendUp ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {trend}
                </div>
            )}
        </div>
    );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
    icon: Icon, title, subtitle, badge, color = "text-primary"
}: {
    icon: React.ElementType; title: string; subtitle: string; badge?: string; color?: string;
}) {
    return (
        <div className="flex items-start gap-3 mb-5">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border", `bg-current/[0.08] border-current/20`, color)}>
                <Icon className={cn("h-5 w-5", color)} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold">{title}</h2>
                    {badge && (
                        <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {badge}
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}

// ─── Vuln Row ─────────────────────────────────────────────────────────────────

const SEV_MAP: Record<string, { label: string; cls: string }> = {
    CRITICAL: { label: "Critical", cls: "bg-red-500/10 text-red-500 border-red-500/30" },
    ERROR: { label: "High", cls: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
    HIGH: { label: "High", cls: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
    MEDIUM: { label: "Medium", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
    WARNING: { label: "Medium", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
    LOW: { label: "Low", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
    INFO: { label: "Info", cls: "bg-blue-500/10 text-blue-400 border-blue-400/30" },
};

function VulnRow({ sev, name, detail }: { sev: string; name: string; detail: string }) {
    const s = SEV_MAP[sev] ?? SEV_MAP.INFO;
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4.5 shrink-0 font-medium", s.cls)}>{s.label}</Badge>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{detail}</p>
            </div>
        </div>
    );
}

// ─── SAST Section (Dynamic) ───────────────────────────────────────────────────

async function fetchRepos(token: string): Promise<Repo[]> {
    const res = await fetch(`${BACKEND_URL}/api/github/repos`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return res.json();
}

async function fetchLatestScan(token: string, owner: string, repo: string): Promise<LatestScan | null> {
    try {
        const res = await fetch(`${BACKEND_URL}/api/scan/${owner}/${repo}/latest`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.scan ?? null;
    } catch {
        return null;
    }
}

function SASTScanRow({ repo, token }: { repo: Repo; token: string }) {
    const navigate = useNavigate();
    const [owner, repoName] = repo.full_name.split("/");

    const { data: scan, isLoading } = useQuery<LatestScan | null>({
        queryKey: ["scan-latest", repo.full_name],
        queryFn: () => fetchLatestScan(token, owner, repoName),
        staleTime: 2 * 60 * 1000,
        retry: 0,
    });

    const total = scan?.finding_count ?? 0;
    const summary = scan?.severity_summary;

    return (
        <div className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0 group">
            <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
                <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{repo.name}</p>
                <p className="text-[10px] text-muted-foreground">
                    {repo.language ?? "Unknown"} · {timeAgo(repo.updated_at)}
                </p>
            </div>

            {isLoading ? (
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            ) : scan?.status === "completed" && total > 0 ? (
                <div className="flex items-center gap-1.5 shrink-0">
                    {summary?.CRITICAL ? (
                        <span className="text-[10px] font-semibold text-red-500">{summary.CRITICAL}C</span>
                    ) : null}
                    {summary?.ERROR ? (
                        <span className="text-[10px] font-semibold text-orange-500">{summary.ERROR}H</span>
                    ) : null}
                    {summary?.WARNING ? (
                        <span className="text-[10px] font-semibold text-yellow-600">{summary.WARNING}M</span>
                    ) : null}
                    <span className="text-[10px] text-muted-foreground">({total})</span>
                </div>
            ) : scan?.status === "completed" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : scan?.status === "failed" ? (
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            ) : (
                <span className="text-[10px] text-muted-foreground shrink-0">Not scanned</span>
            )}

            <button
                onClick={() => navigate(`/scan/${owner}/${repoName}`)}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 h-6 w-6 flex items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20"
            >
                <ChevronRight className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{value}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border">
                <div
                    className={cn("h-full rounded-full transition-all duration-500", color)}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = "overview" | "repositories" | "sca" | "sast" | "dast" | "sbom";

export default function DevSecOpsDashboard({ defaultTab = "overview" }: { defaultTab?: TabId }) {
    const { token, hasGitHub } = useAuth();
    const navigate = useNavigate();

    // Use defaultTab directly as activeTab, no need for useState since App.tsx routes change this component
    const activeTab = defaultTab;

    const { data: repos = [], isLoading: reposLoading } = useQuery<Repo[]>({
        queryKey: ["github-repos-devsecops"],
        queryFn: () => fetchRepos(token!),
        enabled: !!token && hasGitHub,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    // ── Dummy Data ────────────────────────────────────────────────────────────

    const overallScore = 62;

    const scaData = {
        score: 55,
        total: 47,
        critical: 3,
        high: 11,
        medium: 18,
        low: 15,
        packages: 284,
        outdated: 32,
        licensed: "SPDX compliant",
        topVulns: [
            { sev: "CRITICAL", name: "lodash < 4.17.21", detail: "Prototype Pollution · CVE-2021-23337" },
            { sev: "CRITICAL", name: "axios < 1.6.0", detail: "SSRF via redirect · CVE-2023-45857" },
            { sev: "CRITICAL", name: "jsonwebtoken < 9.0.0", detail: "Weak asymmetric key · CVE-2022-23529" },
            { sev: "HIGH", name: "express < 4.19.2", detail: "Open Redirect · CVE-2024-29041" },
            { sev: "HIGH", name: "semver < 7.5.2", detail: "ReDoS vulnerability · CVE-2022-25883" },
            { sev: "MEDIUM", name: "minimist < 1.2.6", detail: "Prototype Pollution · CVE-2021-44906" },
        ],
    };

    const dastData = {
        score: 71,
        total: 24,
        critical: 1,
        high: 4,
        medium: 12,
        low: 7,
        lastScan: "2025-01-15T10:30:00Z",
        target: "https://api.be4breach.com",
        topVulns: [
            { sev: "CRITICAL", name: "SQL Injection", detail: "/api/users?id= — confirmed injectable parameter" },
            { sev: "HIGH", name: "Missing CSP Header", detail: "Content-Security-Policy not present on app shell" },
            { sev: "HIGH", name: "CORS Misconfiguration", detail: "Wildcard origin allowed with credentials" },
            { sev: "HIGH", name: "JWT None Algorithm", detail: "Bearer tokens accept 'none' alg in /api/auth" },
            { sev: "MEDIUM", name: "Clickjacking", detail: "X-Frame-Options header missing on login page" },
            { sev: "MEDIUM", name: "Information Disclosure", detail: "Stack traces exposed in error responses" },
        ],
    };

    const sbomData = {
        score: 78,
        totalComponents: 284,
        directDeps: 62,
        transitiveDeps: 222,
        licenses: {
            MIT: 148,
            Apache2: 67,
            BSD: 29,
            GPL: 8,
            Other: 32,
        },
        recentComponents: [
            { name: "react", version: "18.3.1", license: "MIT", risk: "low" },
            { name: "typescript", version: "5.5.4", license: "Apache-2.0", risk: "low" },
            { name: "fastapi", version: "0.111.0", license: "MIT", risk: "low" },
            { name: "pydantic", version: "2.7.4", license: "MIT", risk: "low" },
            { name: "cryptography", version: "42.0.5", license: "Apache-2.0", risk: "medium" },
            { name: "paramiko", version: "3.4.0", license: "LGPL", risk: "medium" },
        ],
    };

    // Derived SAST stats from real repo data (shown as placeholder if no scans)
    const sastScore = repos.length > 0 ? 58 : 0;

    // ── Tab Nav ───────────────────────────────────────────────────────────────

    const tabs = [
        { id: "overview", label: "Overview", icon: BarChart3 },
        { id: "repositories", label: "Repositories", icon: Github },
        { id: "sca", label: "SCA", icon: Package },
        { id: "sast", label: "SAST", icon: Code2 },
        { id: "dast", label: "DAST", icon: Globe },
        { id: "sbom", label: "SBOM", icon: Layers },
    ] as const;

    return (
        <div className="space-y-6 pb-8">
            {/* ── Hero Header ────────────────────────────────────────────────── */}
            <div className="rounded-2xl border bg-card overflow-hidden">
                <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 bg-gradient-to-br from-card via-card to-primary/5">
                    {/* bg accent */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_70%)] pointer-events-none" />

                    <div className="flex items-center gap-4 flex-1">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Shield className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                DevSecOps
                                <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary bg-primary/5">
                                    LIVE
                                </Badge>
                            </h1>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Unified security posture · SCA · SAST · DAST · SBOM
                            </p>
                        </div>
                    </div>

                    {/* Overall score */}
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Security Score</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{scoreColor(overallScore).label} posture</p>
                        </div>
                        <ScoreRing score={overallScore} size={72} />
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex border-t overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                id={`devsecops-tab-${tab.id}`}
                                onClick={() => navigate(tab.id === "overview" ? "/devsecops" : `/devsecops/${tab.id}`)}
                                className={cn(
                                    "flex items-center gap-2 px-5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                OVERVIEW TAB
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    {/* Score cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: "SCA", icon: Package, score: scaData.score, desc: `${scaData.total} vulns found`, color: "text-orange-500", onClick: () => navigate("/devsecops/sca") },
                            { label: "SAST", icon: Code2, score: sastScore, desc: `${repos.length} repos scanned`, color: "text-red-500", onClick: () => navigate("/devsecops/sast") },
                            { label: "DAST", icon: Globe, score: dastData.score, desc: `${dastData.total} issues found`, color: "text-blue-500", onClick: () => navigate("/devsecops/dast") },
                            { label: "SBOM", icon: Layers, score: sbomData.score, desc: `${sbomData.totalComponents} components`, color: "text-emerald-500", onClick: () => navigate("/devsecops/sbom") },
                        ].map(({ label, icon: Icon, score, desc, color, onClick }) => (
                            <button
                                key={label}
                                onClick={onClick}
                                className="rounded-xl border bg-card p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className={cn("h-8 w-8 rounded-lg bg-current/10 flex items-center justify-center", color)}>
                                        <Icon className={cn("h-4 w-4", color)} />
                                    </div>
                                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <ScoreRing score={score} size={56} />
                                <p className="text-xs font-semibold mt-2">{label}</p>
                                <p className="text-[10px] text-muted-foreground">{desc}</p>
                            </button>
                        ))}
                    </div>

                    {/* Vulnerability breakdown + Recent activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Vuln breakdown */}
                        <div className="lg:col-span-2 rounded-xl border bg-card p-5">
                            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                <Bug className="h-4 w-4 text-destructive" />
                                Vulnerability Breakdown
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                                {[
                                    { label: "Critical", count: scaData.critical + dastData.critical + 2, cls: "text-red-500 bg-red-500/10" },
                                    { label: "High", count: scaData.high + dastData.high + 5, cls: "text-orange-500 bg-orange-500/10" },
                                    { label: "Medium", count: scaData.medium + dastData.medium + 8, cls: "text-yellow-600 bg-yellow-500/10" },
                                    { label: "Low", count: scaData.low + dastData.low + 3, cls: "text-blue-500 bg-blue-500/10" },
                                ].map(({ label, count, cls }) => (
                                    <div key={label} className={cn("rounded-lg p-3 text-center", cls.split(" ")[1])}>
                                        <p className={cn("text-xl font-bold", cls.split(" ")[0])}>{count}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-3">
                                <MiniBar label="SCA (Dependencies)" value={scaData.total} max={100} color="bg-orange-500" />
                                <MiniBar label="SAST (Code)" value={22} max={100} color="bg-red-500" />
                                <MiniBar label="DAST (Runtime)" value={dastData.total} max={100} color="bg-blue-500" />
                            </div>
                        </div>

                        {/* Posture summary */}
                        <div className="rounded-xl border bg-card p-5 space-y-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Target className="h-4 w-4 text-primary" />
                                Security Posture
                            </h3>
                            {[
                                { label: "Secrets Detected", ok: false, note: "3 active secrets in code" },
                                { label: "SAST Scans", ok: true, note: `${repos.length} repos monitored` },
                                { label: "Dependency Audit", ok: false, note: "32 outdated packages" },
                                { label: "DAST Coverage", ok: true, note: "API endpoints scanned" },
                                { label: "SBOM Generated", ok: true, note: "CycloneDX format" },
                                { label: "License Compliance", ok: true, note: "No GPL conflicts" },
                                { label: "Container Scan", ok: false, note: "Not configured yet" },
                            ].map(({ label, ok, note }) => (
                                <div key={label} className="flex items-start gap-2.5">
                                    {ok
                                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                        : <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                                    }
                                    <div>
                                        <p className="text-xs font-medium">{label}</p>
                                        <p className="text-[10px] text-muted-foreground">{note}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Critical Findings */}
                    <div className="rounded-xl border bg-card p-5">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            Top Critical & High Findings
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[
                                { tag: "SCA", sev: "CRITICAL", title: "lodash Prototype Pollution", detail: "CVE-2021-23337 · 4 projects affected" },
                                { tag: "SAST", sev: "CRITICAL", title: "Hardcoded Secret Detected", detail: "AWS key in backend/config.py · Line 42" },
                                { tag: "DAST", sev: "CRITICAL", title: "SQL Injection", detail: "/api/users endpoint · confirmed injectable" },
                                { tag: "SCA", sev: "HIGH", title: "axios SSRF", detail: "CVE-2023-45857 · 6 projects affected" },
                                { tag: "DAST", sev: "HIGH", title: "CORS Misconfiguration", detail: "Wildcard + credentials on API" },
                                { tag: "SAST", sev: "HIGH", title: "Insecure Deserialization", detail: "pickle.loads() on user input · 2 files" },
                            ].map(({ tag, sev, title, detail }, i) => {
                                const s = SEV_MAP[sev];
                                const tagColors: Record<string, string> = {
                                    SCA: "bg-orange-500/10 text-orange-500",
                                    SAST: "bg-red-500/10 text-red-500",
                                    DAST: "bg-blue-500/10 text-blue-500",
                                };
                                return (
                                    <div key={i} className="rounded-lg border bg-secondary/30 p-3 space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold", tagColors[tag])}>{tag}</span>
                                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 font-medium", s.cls)}>{s.label}</Badge>
                                        </div>
                                        <p className="text-xs font-semibold">{title}</p>
                                        <p className="text-[10px] text-muted-foreground">{detail}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                REPOSITORIES TAB
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "repositories" && (
                <div className="rounded-xl border bg-card p-6">
                    <RepositoriesPage />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                SCA TAB
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "sca" && (
                <div className="space-y-5">
                    <SectionHeader
                        icon={Package}
                        title="Software Composition Analysis"
                        subtitle="Detect vulnerabilities in open-source dependencies and third-party libraries"
                        // 
                        color="text-orange-500"
                    />

                    {/* Stats row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard title="Total Vulns" value={scaData.total} sub="across all deps" icon={Bug} iconCls="bg-red-500/10 text-red-500" trend="8 new this week" trendUp={false} />
                        <StatCard title="Critical" value={scaData.critical} sub="require immediate fix" icon={AlertCircle} iconCls="bg-red-500/10 text-red-500" />
                        <StatCard title="Total Packages" value={scaData.packages} sub={`${scaData.outdated} outdated`} icon={Package} iconCls="bg-orange-500/10 text-orange-500" />
                        <StatCard title="Score" value={`${scaData.score}/100`} sub={scoreColor(scaData.score).label} icon={Shield} iconCls="bg-yellow-500/10 text-yellow-600" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Top Vulnerabilities */}
                        <div className="rounded-xl border bg-card p-5">
                            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                Top Vulnerability Findings
                            </h3>
                            {scaData.topVulns.map((v, i) => (
                                <VulnRow key={i} sev={v.sev} name={v.name} detail={v.detail} />
                            ))}
                        </div>

                        {/* Severity breakdown */}
                        <div className="rounded-xl border bg-card p-5 space-y-5">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-primary" />
                                Severity Distribution
                            </h3>
                            <div className="flex items-center justify-center">
                                <ScoreRing score={scaData.score} size={100} />
                            </div>
                            <div className="space-y-3">
                                <MiniBar label="Critical" value={scaData.critical} max={scaData.total} color="bg-red-500" />
                                <MiniBar label="High" value={scaData.high} max={scaData.total} color="bg-orange-500" />
                                <MiniBar label="Medium" value={scaData.medium} max={scaData.total} color="bg-yellow-500" />
                                <MiniBar label="Low" value={scaData.low} max={scaData.total} color="bg-blue-400" />
                            </div>

                            <div className="pt-3 border-t space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Tool</span>
                                    <span className="font-medium text-muted-foreground">Snyk / OWASP Dependency-Check</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Status</span>
                                    <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-600 bg-yellow-500/5">
                                        Coming Soon
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                SAST TAB  (Dynamic — Semgrep)
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "sast" && (
                <div className="space-y-5">
                    <SectionHeader
                        icon={Code2}
                        title="Static Application Security Testing"
                        subtitle="Semgrep-powered code analysis — real-time results from your connected repositories"
                        // badge="Powered by Semgrep"
                        color="text-red-500"
                    />

                    {/* Stats row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard title="Repos Monitored" value={repos.length || 0} sub="GitHub connected" icon={Code2} iconCls="bg-red-500/10 text-red-500" />
                        <StatCard title="SAST Score" value={repos.length ? `${sastScore}/100` : "N/A"} sub={repos.length ? scoreColor(sastScore).label : "Connect GitHub"} icon={Shield} iconCls="bg-primary/10 text-primary" />
                        <StatCard title="Engine" value="Semgrep" sub="OSS · 3800+ rules" icon={Cpu} iconCls="bg-purple-500/10 text-purple-500" />
                        <StatCard title="Rule Coverage" value="OWASP Top 10" sub="CWE mapped" icon={Target} iconCls="bg-emerald-500/10 text-emerald-500" />
                    </div>

                    {!hasGitHub ? (
                        <div className="rounded-xl border bg-card p-10 flex flex-col items-center gap-4 text-center">
                            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                                <Code2 className="h-7 w-7 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold">Connect GitHub to see live SAST results</p>
                                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                    Link your GitHub account in Settings to enable Semgrep scanning across all your repositories.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate("/settings")}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                            >
                                Go to Settings
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    ) : reposLoading ? (
                        <div className="rounded-xl border bg-card p-8 flex items-center justify-center">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Repo scan list */}
                            <div className="rounded-xl border bg-card p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-primary" />
                                        Repository Scan Status
                                    </h3>
                                    <button
                                        onClick={() => navigate("/devsecops/repositories")}
                                        className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                                    >
                                        View all repos
                                        <ExternalLink className="h-3 w-3" />
                                    </button>
                                </div>
                                <div className="max-h-80 overflow-y-auto pr-1">
                                    {repos.slice(0, 15).map((repo) => (
                                        <SASTScanRow key={repo.id} repo={repo} token={token!} />
                                    ))}
                                    {repos.length === 0 && (
                                        <p className="text-xs text-muted-foreground py-4 text-center">No repositories found</p>
                                    )}
                                </div>
                            </div>

                            {/* SAST info */}
                            <div className="space-y-4">
                                <div className="rounded-xl border bg-card p-5">
                                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                        <Info className="h-4 w-4 text-blue-500" />
                                        Rule Coverage
                                    </h3>
                                    <div className="space-y-3">
                                        {[
                                            { label: "Injection Flaws (SQLi, XSS, SSTI)", pct: 92, color: "bg-red-500" },
                                            { label: "Secrets & Credentials", pct: 88, color: "bg-orange-500" },
                                            { label: "Insecure Deserialization", pct: 75, color: "bg-yellow-500" },
                                            { label: "Cryptographic Failures", pct: 70, color: "bg-purple-500" },
                                            { label: "Security Misconfigurations", pct: 68, color: "bg-blue-500" },
                                        ].map(({ label, pct, color }) => (
                                            <div key={label} className="space-y-1">
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-muted-foreground">{label}</span>
                                                    <span className="font-semibold">{pct}%</span>
                                                </div>
                                                <div className="h-1.5 w-full rounded-full bg-border">
                                                    <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-xl border bg-card p-5">
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-yellow-500" />
                                        Scan to see full results
                                    </h3>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Click on any repository above or go to the Repositories page to run a Semgrep scan and see detailed vulnerability findings.
                                    </p>
                                    <button
                                        onClick={() => navigate("/devsecops/repositories")}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                                    >
                                        <Search className="h-4 w-4" />
                                        Scan a Repository
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                DAST TAB
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "dast" && (
                <div className="space-y-5">
                    <SectionHeader
                        icon={Globe}
                        title="Dynamic Application Security Testing"
                        subtitle="Runtime vulnerability scanning for APIs, web apps, and live environments"
                        color="text-blue-500"
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard title="Total Issues" value={dastData.total} sub="runtime detected" icon={Bug} iconCls="bg-red-500/10 text-red-500" trend="3 fixed this week" trendUp />
                        <StatCard title="Critical" value={dastData.critical} sub="needs immediate fix" icon={AlertCircle} iconCls="bg-red-500/10 text-red-500" />
                        <StatCard title="Target" value="1 App" sub="API + Web" icon={Globe} iconCls="bg-blue-500/10 text-blue-500" />
                        <StatCard title="Score" value={`${dastData.score}/100`} sub={scoreColor(dastData.score).label} icon={Shield} iconCls="bg-blue-500/10 text-blue-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Issues list */}
                        <div className="rounded-xl border bg-card p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-blue-500" />
                                    Runtime Findings
                                </h3>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {timeAgo(dastData.lastScan)}
                                </div>
                            </div>
                            {dastData.topVulns.map((v, i) => (
                                <VulnRow key={i} sev={v.sev} name={v.name} detail={v.detail} />
                            ))}
                        </div>

                        {/* Info panel */}
                        <div className="space-y-4">
                            <div className="rounded-xl border bg-card p-5">
                                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                    <Target className="h-4 w-4 text-primary" />
                                    Scan Target
                                </h3>
                                <div className="space-y-3">
                                    {[
                                        { label: "Target URL", value: dastData.target },
                                        { label: "Last Scan", value: new Date(dastData.lastScan).toLocaleDateString() },
                                        { label: "Scanner", value: "OWASP ZAP / Burp Suite" },
                                        { label: "Coverage", value: "REST API + Web App" },
                                        { label: "Auth", value: "JWT Bearer" },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex items-center justify-between text-xs border-b border-border/40 pb-2 last:border-0">
                                            <span className="text-muted-foreground">{label}</span>
                                            <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-xl border bg-card p-5">
                                <h3 className="text-sm font-semibold mb-3">Severity Distribution</h3>
                                <div className="space-y-3">
                                    <MiniBar label="Critical" value={dastData.critical} max={dastData.total} color="bg-red-500" />
                                    <MiniBar label="High" value={dastData.high} max={dastData.total} color="bg-orange-500" />
                                    <MiniBar label="Medium" value={dastData.medium} max={dastData.total} color="bg-yellow-500" />
                                    <MiniBar label="Low" value={dastData.low} max={dastData.total} color="bg-blue-400" />
                                </div>
                                <div className="mt-4 pt-3 border-t">
                                    <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-500 bg-blue-500/5">
                                        Integration available Q2 2025
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                SBOM TAB
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "sbom" && (
                <div className="space-y-5">
                    <SectionHeader
                        icon={Layers}
                        title="Software Bill of Materials"
                        subtitle="Complete inventory of all software components, dependencies, and licenses in your supply chain"

                        color="text-emerald-500"
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard title="Total Components" value={sbomData.totalComponents} sub="direct + transitive" icon={Layers} iconCls="bg-emerald-500/10 text-emerald-500" />
                        <StatCard title="Direct Deps" value={sbomData.directDeps} sub="first-party" icon={Package} iconCls="bg-blue-500/10 text-blue-500" />
                        <StatCard title="Transitive Deps" value={sbomData.transitiveDeps} sub="indirect" icon={Database} iconCls="bg-purple-500/10 text-purple-500" />
                        <StatCard title="Score" value={`${sbomData.score}/100`} sub={scoreColor(sbomData.score).label} icon={Shield} iconCls="bg-emerald-500/10 text-emerald-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Component table */}
                        <div className="rounded-xl border bg-card p-5">
                            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                <Package className="h-4 w-4 text-emerald-500" />
                                Component Inventory (Top)
                            </h3>
                            <div className="space-y-0">
                                <div className="grid grid-cols-3 text-[10px] text-muted-foreground uppercase tracking-wider pb-2 border-b border-border/50 font-medium">
                                    <span>Component</span>
                                    <span>Version</span>
                                    <span>License / Risk</span>
                                </div>
                                {sbomData.recentComponents.map((c, i) => (
                                    <div key={i} className="grid grid-cols-3 text-xs py-2.5 border-b border-border/40 last:border-0 items-center">
                                        <span className="font-mono font-medium">{c.name}</span>
                                        <span className="text-muted-foreground">{c.version}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground text-[10px]">{c.license}</span>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[9px] px-1 py-0 h-4 font-medium",
                                                    c.risk === "low" ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" : "border-yellow-500/30 text-yellow-600 bg-yellow-500/5"
                                                )}
                                            >
                                                {c.risk}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-3">
                                + {sbomData.totalComponents - sbomData.recentComponents.length} more components in full SBOM report
                            </p>
                        </div>

                        {/* License breakdown */}
                        <div className="rounded-xl border bg-card p-5 space-y-5">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                License Distribution
                            </h3>
                            <div className="space-y-3">
                                {Object.entries(sbomData.licenses).map(([lic, count]) => (
                                    <MiniBar
                                        key={lic}
                                        label={lic === "Apache2" ? "Apache 2.0" : lic}
                                        value={count}
                                        max={sbomData.totalComponents}
                                        color={lic === "GPL" ? "bg-red-500" : lic === "MIT" ? "bg-emerald-500" : lic === "Apache2" ? "bg-blue-500" : lic === "BSD" ? "bg-purple-500" : "bg-muted-foreground"}
                                    />
                                ))}
                            </div>

                            <div className="pt-3 border-t space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Format</span>
                                    <span className="font-medium">CycloneDX 1.6 / SPDX 2.3</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">GPL Packages</span>
                                    <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-500 bg-orange-500/5">
                                        8 — Review required
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Export Status</span>
                                    <div className="flex items-center gap-1">
                                        <Lock className="h-3 w-3 text-muted-foreground" />
                                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                                            Available
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    disabled
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium opacity-50 cursor-not-allowed"
                                    title="Coming soon"
                                >
                                    <FileText className="h-3.5 w-3.5" />
                                    Export CycloneDX
                                </button>
                                <button
                                    disabled
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium opacity-50 cursor-not-allowed"
                                    title="Coming soon"
                                >
                                    <FileText className="h-3.5 w-3.5" />
                                    Export SPDX
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
