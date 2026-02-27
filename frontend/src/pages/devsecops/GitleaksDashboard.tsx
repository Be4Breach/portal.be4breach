import { useState, useEffect, useCallback } from "react";
import {
    KeyRound, Bug, AlertCircle, Shield, RefreshCw,
    Code2, Loader2, FileCode2, ChevronDown, ChevronRight,
    Search, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BACKEND_URL from "@/lib/api";
import { SectionHeader, StatCard, ScoreRing, MiniBar, scoreColor, timeAgo } from "./Shared";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GitleaksFinding {
    rule_id: string;
    severity: string;
    message: string;
    file_path: string;
    line_start: number | null;
    code_snippet?: string;
    commit?: string;
    cwe?: string[];
    fix?: string;
    // injected client-side
    repo_full_name?: string;
    scan_completed_at?: string;
}

interface RepoScanSummary {
    repo: string;
    count: number;
    critical: number;
    high: number;
    scan_id: string;
    completed_at: string;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEV = {
    CRITICAL: { label: "Critical", badge: "bg-red-500/10 text-red-500 border-red-500/30", left: "border-l-red-500" },
    HIGH: { label: "High", badge: "bg-orange-500/10 text-orange-500 border-orange-500/30", left: "border-l-orange-500" },
    MEDIUM: { label: "Medium", badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30", left: "border-l-yellow-500" },
    LOW: { label: "Low", badge: "bg-blue-500/10 text-blue-500 border-blue-400/30", left: "border-l-blue-400" },
} as const;

const getSev = (s: string) => SEV[s as keyof typeof SEV] ?? SEV.LOW;

// ─── Finding card ─────────────────────────────────────────────────────────────

function FindingCard({ f }: { f: GitleaksFinding }) {
    const [open, setOpen] = useState(false);
    const sev = getSev(f.severity);
    return (
        <div className={cn("border-l-2 rounded-lg border bg-card transition-all", sev.left, open && "shadow-sm")}>
            <button className="w-full flex items-start gap-3 p-4 text-left" onClick={() => setOpen(o => !o)}>
                <KeyRound className={cn("h-4 w-4 mt-0.5 shrink-0",
                    f.severity === "CRITICAL" ? "text-red-500" : "text-orange-500"
                )} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0", sev.badge)}>
                            {sev.label}
                        </span>
                        <code className="text-[11px] text-muted-foreground font-mono truncate">{f.rule_id}</code>
                    </div>
                    <p className="text-sm font-medium mt-1 leading-snug">{f.message}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                        <FileCode2 className="h-3 w-3 shrink-0" />
                        <span className="font-mono truncate">{f.file_path}</span>
                        {f.line_start != null && <span className="shrink-0">:{f.line_start}</span>}
                    </div>
                    {f.repo_full_name && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                            <code className="font-mono">{f.repo_full_name}</code>
                            <a
                                href={`https://github.com/${f.repo_full_name}`}
                                target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                            >
                                <ExternalLink className="h-2.5 w-2.5 hover:text-primary" />
                            </a>
                        </div>
                    )}
                </div>
                {open
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                }
            </button>
            {open && (
                <div className="px-4 pb-4 pt-3 border-t border-border/50 space-y-3">
                    {f.code_snippet && (
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">
                                Detected value (masked)
                            </p>
                            <div className="rounded-md bg-secondary px-3 py-2">
                                <code className="text-xs font-mono">{f.code_snippet}</code>
                            </div>
                        </div>
                    )}
                    {f.commit && (
                        <p className="text-[11px] text-muted-foreground font-mono">
                            Commit: <span className="text-foreground">{f.commit}</span>
                        </p>
                    )}
                    {f.fix && (
                        <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
                            <p className="text-[10px] text-emerald-600 uppercase tracking-widest font-bold mb-1">Remediation</p>
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">{f.fix}</p>
                        </div>
                    )}
                    {f.cwe && f.cwe.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                            {f.cwe.map(c => (
                                <span key={c} className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-secondary">{c}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function GitleaksDashboard() {
    const { token, hasGitHub } = useAuth();

    const [allFindings, setAllFindings] = useState<GitleaksFinding[]>([]);
    const [repoSummaries, setRepoSummaries] = useState<RepoScanSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [filterSev, setFilterSev] = useState("all");
    const [filterSearch, setFilterSearch] = useState("");
    const [filterRepo, setFilterRepo] = useState("all");

    const fetchAll = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            // 1. Get all scans for user
            const histRes = await fetch(`${BACKEND_URL}/api/scans/history`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!histRes.ok) return;
            const scans: any[] = await histRes.json();

            // 2. Only look at completed scans that have gitleaks results
            const completedScans = scans.filter(
                s => s.gitleaks_status === "completed"
            );

            // 3. Fetch gitleaks findings for each completed scan in parallel
            const results = await Promise.allSettled(
                completedScans.map(s =>
                    fetch(`${BACKEND_URL}/api/scan/${s.id}/gitleaks`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }).then(r => r.ok ? r.json() : null)
                )
            );

            // 4. Aggregate findings across all repos
            const collected: GitleaksFinding[] = [];
            const summaries: RepoScanSummary[] = [];

            results.forEach((res, idx) => {
                if (res.status !== "fulfilled" || !res.value) return;
                const scan = completedScans[idx];
                const findings: GitleaksFinding[] = (res.value.findings ?? []).map((f: GitleaksFinding) => ({
                    ...f,
                    repo_full_name: scan.repo_full_name,
                    scan_completed_at: scan.completed_at,
                }));
                collected.push(...findings);

                const critical = findings.filter(f => f.severity === "CRITICAL").length;
                const high = findings.filter(f => f.severity === "HIGH").length;
                if (findings.length > 0) {
                    summaries.push({
                        repo: scan.repo_full_name,
                        count: findings.length,
                        critical,
                        high,
                        scan_id: scan.id,
                        completed_at: scan.completed_at,
                    });
                }
            });

            // Sort by critical > high > total
            collected.sort((a, b) => {
                const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                return (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4);
            });
            summaries.sort((a, b) => b.critical - a.critical || b.high - a.high);

            setAllFindings(collected);
            setRepoSummaries(summaries);
            setLastRefreshed(new Date());
        } catch (err) {
            console.error("GitleaksDashboard fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Derived stats ──────────────────────────────────────────────────────────
    const totalSecrets = allFindings.length;
    const critical = allFindings.filter(f => f.severity === "CRITICAL").length;
    const high = allFindings.filter(f => f.severity === "HIGH").length;
    const medium = allFindings.filter(f => f.severity === "MEDIUM").length;
    const low = allFindings.filter(f => f.severity === "LOW").length;

    // Score: starts at 100, penalised per finding
    const rawScore = Math.max(0, 100 - (critical * 15) - (high * 8) - (medium * 3) - (low * 1));
    const score = totalSecrets === 0 ? 100 : rawScore;

    // Categorise by rule keyword
    const apiKeys = allFindings.filter(f => /api[_-]?key|token/i.test(f.rule_id)).length;
    const cloudCreds = allFindings.filter(f => /aws|gcp|azure|cloud/i.test(f.rule_id)).length;
    const privKeys = allFindings.filter(f => /private[_-]?key|rsa|ssh/i.test(f.rule_id)).length;
    const other = Math.max(0, totalSecrets - apiKeys - cloudCreds - privKeys);

    // Unique repos scanned
    const uniqueRepos = new Set(allFindings.map(f => f.repo_full_name)).size;

    // ── Filters ────────────────────────────────────────────────────────────────
    const filtered = allFindings.filter(f => {
        if (filterSev !== "all" && f.severity !== filterSev) return false;
        if (filterRepo !== "all" && f.repo_full_name !== filterRepo) return false;
        if (filterSearch) {
            const q = filterSearch.toLowerCase();
            return (
                f.rule_id.toLowerCase().includes(q) ||
                f.message.toLowerCase().includes(q) ||
                f.file_path.toLowerCase().includes(q) ||
                (f.repo_full_name ?? "").toLowerCase().includes(q)
            );
        }
        return true;
    });

    const allRepos = Array.from(new Set(allFindings.map(f => f.repo_full_name ?? "")));

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <SectionHeader
                    icon={KeyRound}
                    title="Secrets Detection"
                    subtitle="Live secrets found across all your scanned repositories using Gitleaks"
                    color="text-fuchsia-500"
                    badge={lastRefreshed ? `Updated ${timeAgo(lastRefreshed.toISOString())}` : undefined}
                />
                <button
                    onClick={fetchAll}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border bg-card/60 hover:bg-card hover:shadow-sm transition-all disabled:opacity-50"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                    Refresh
                </button>
            </div>

            {/* Loading state */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
                    <p className="text-sm">Scanning across all repositories…</p>
                </div>
            )}

            {/* No GitHub connected */}
            {!isLoading && !hasGitHub && (
                <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed rounded-2xl">
                    <Shield className="h-10 w-10 text-muted-foreground opacity-40" />
                    <p className="font-semibold">GitHub not connected</p>
                    <p className="text-sm text-muted-foreground">Connect your GitHub account to start scanning for secrets.</p>
                </div>
            )}

            {/* No scans done */}
            {!isLoading && hasGitHub && repoSummaries.length === 0 && allFindings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed rounded-2xl bg-muted/10">
                    <KeyRound className="h-10 w-10 text-fuchsia-500 opacity-40" />
                    <p className="font-semibold">No secrets scan results yet</p>
                    <p className="text-sm text-muted-foreground max-w-sm text-center">
                        Head to the <strong>Repositories</strong> tab and scan a project.
                        Gitleaks will automatically run alongside Semgrep.
                    </p>
                </div>
            )}

            {/* Main content */}
            {!isLoading && (totalSecrets > 0 || repoSummaries.length > 0) && (
                <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Total Secrets"
                            value={totalSecrets}
                            sub={`across ${uniqueRepos} repo${uniqueRepos !== 1 ? "s" : ""}`}
                            icon={Bug}
                            iconCls="bg-red-500/10 text-red-500"
                        />
                        <StatCard
                            title="Critical / High"
                            value={`${critical} / ${high}`}
                            sub="exposed credentials"
                            icon={AlertCircle}
                            iconCls="bg-orange-500/10 text-orange-500"
                        />
                        <StatCard
                            title="Repos Scanned"
                            value={repoSummaries.length}
                            sub="with Gitleaks"
                            icon={RefreshCw}
                            iconCls="bg-blue-500/10 text-blue-500"
                        />
                        <StatCard
                            title="Secret Score"
                            value={`${score}/100`}
                            sub={scoreColor(score).label}
                            icon={Shield}
                            iconCls="bg-fuchsia-500/10 text-fuchsia-500"
                        />
                    </div>

                    {/* Score ring + breakdown / Per-repo summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Per-repo table */}
                        <div className="lg:col-span-2 rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm">
                            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                <Code2 className="h-4 w-4 text-fuchsia-500" />
                                Repositories with Exposed Secrets
                            </h3>
                            <div className="space-y-2">
                                {repoSummaries.map(r => (
                                    <div key={r.repo} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold font-mono truncate">{r.repo}</p>
                                            <p className="text-[10px] text-muted-foreground">{timeAgo(r.completed_at)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {r.critical > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/30">
                                                    {r.critical} CRIT
                                                </span>
                                            )}
                                            {r.high > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/30">
                                                    {r.high} HIGH
                                                </span>
                                            )}
                                            <span className="text-xs font-semibold text-muted-foreground w-8 text-right">
                                                {r.count} total
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {repoSummaries.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-6">
                                        No repositories with secrets found.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Score ring + type distribution */}
                        <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm flex flex-col gap-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Shield className="h-4 w-4 text-primary" />
                                Secret Health
                            </h3>
                            <div className="flex justify-center my-2">
                                <ScoreRing score={score} size={120} />
                            </div>
                            <div className="space-y-3">
                                <MiniBar label="API Keys / Tokens" value={apiKeys} max={totalSecrets || 1} color="bg-fuchsia-500" />
                                <MiniBar label="Cloud Credentials" value={cloudCreds} max={totalSecrets || 1} color="bg-orange-500" />
                                <MiniBar label="Private Keys" value={privKeys} max={totalSecrets || 1} color="bg-red-500" />
                                <MiniBar label="Other" value={other} max={totalSecrets || 1} color="bg-blue-400" />
                            </div>
                        </div>
                    </div>

                    {/* Findings list */}
                    <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <KeyRound className="h-4 w-4 text-fuchsia-500" />
                                All Exposed Secrets
                                <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                                    {filtered.length}
                                </span>
                            </h3>
                            {/* Filters */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                    <input
                                        placeholder="Search secrets…"
                                        value={filterSearch}
                                        onChange={e => setFilterSearch(e.target.value)}
                                        className="h-8 pl-8 pr-3 rounded-lg border bg-secondary text-xs focus:outline-none focus:ring-1 focus:ring-primary w-44"
                                    />
                                </div>
                                <select
                                    value={filterSev}
                                    onChange={e => setFilterSev(e.target.value)}
                                    className="h-8 px-3 rounded-lg border bg-secondary text-xs cursor-pointer focus:outline-none"
                                >
                                    <option value="all">All severities</option>
                                    <option value="CRITICAL">Critical</option>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="LOW">Low</option>
                                </select>
                                {allRepos.length > 1 && (
                                    <select
                                        value={filterRepo}
                                        onChange={e => setFilterRepo(e.target.value)}
                                        className="h-8 px-3 rounded-lg border bg-secondary text-xs cursor-pointer focus:outline-none max-w-[160px]"
                                    >
                                        <option value="all">All repos</option>
                                        {allRepos.map(r => <option key={r} value={r}>{r.split("/")[1]}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                                <Bug className="h-8 w-8 opacity-30" />
                                <p className="text-sm">No secrets match your filters.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filtered.map((f, i) => (
                                    <FindingCard key={`${f.repo_full_name}-${f.rule_id}-${f.file_path}-${i}`} f={f} />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
