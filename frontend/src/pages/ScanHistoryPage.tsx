import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import BACKEND_URL from "@/lib/api";
import {
    Shield, Play, Loader2, ArrowLeft, Clock, CheckCircle2,
    AlertTriangle, XCircle, ChevronRight, GitBranch, KeyRound,
    Bug, RefreshCw, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanRecord {
    id: string;
    repo_full_name: string;
    status: "queued" | "running" | "completed" | "failed";
    created_at: string | null;
    completed_at: string | null;
    started_at: string | null;
    finding_count: number;
    severity_summary: { CRITICAL: number; ERROR: number; WARNING: number; INFO: number };
    gitleaks_status?: string;
    gitleaks_finding_count?: number;
    gitleaks_severity?: { CRITICAL: number; HIGH: number };
    error?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
    if (!iso) return "—";
    const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z";
    return new Date(s).toLocaleString(undefined, {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function duration(start: string | null, end: string | null): string {
    if (!start || !end) return "—";
    const s1 = /Z|[+-]\d{2}:\d{2}$/.test(start) ? start : start + "Z";
    const s2 = /Z|[+-]\d{2}:\d{2}$/.test(end) ? end : end + "Z";
    const ms = new Date(s2).getTime() - new Date(s1).getTime();
    if (ms < 0) return "—";
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

const STATUS_CONFIG = {
    completed: {
        icon: CheckCircle2,
        label: "Completed",
        cls: "text-emerald-500",
        badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
        dot: "bg-emerald-500",
    },
    running: {
        icon: Loader2,
        label: "Running",
        cls: "text-blue-500",
        badge: "bg-blue-500/10 text-blue-500 border-blue-500/30",
        dot: "bg-blue-500 animate-pulse",
    },
    queued: {
        icon: Clock,
        label: "Queued",
        cls: "text-yellow-500",
        badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
        dot: "bg-yellow-500",
    },
    failed: {
        icon: XCircle,
        label: "Failed",
        cls: "text-red-500",
        badge: "bg-red-500/10 text-red-500 border-red-500/30",
        dot: "bg-red-500",
    },
};

// ─── ScanRow ──────────────────────────────────────────────────────────────────

function ScanRow({ scan, index, onClick }: { scan: ScanRecord; index: number; onClick: () => void }) {
    const cfg = STATUS_CONFIG[scan.status] || STATUS_CONFIG.failed;
    const Icon = cfg.icon;
    const critical = scan.severity_summary?.CRITICAL ?? 0;
    const high = scan.severity_summary?.ERROR ?? 0;
    const medium = scan.severity_summary?.WARNING ?? 0;
    const glCrit = scan.gitleaks_severity?.CRITICAL ?? 0;
    const glHigh = scan.gitleaks_severity?.HIGH ?? 0;

    return (
        <button
            onClick={onClick}
            className="w-full group flex items-center gap-4 p-5 rounded-2xl border bg-card/40 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 text-left"
        >
            {/* Index */}
            <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                #{index + 1}
            </div>

            {/* Status icon */}
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                scan.status === "running" ? "bg-blue-500/10" :
                    scan.status === "completed" ? "bg-emerald-500/10" :
                        scan.status === "failed" ? "bg-red-500/10" : "bg-yellow-500/10"
            )}>
                <Icon className={cn("h-5 w-5", cfg.cls, scan.status === "running" && "animate-spin")} />
            </div>

            {/* Date + duration */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{fmtDate(scan.created_at)}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{duration(scan.started_at, scan.completed_at)}</span>
                    <span className={cn("px-1.5 py-0.5 rounded-full border text-[10px] font-semibold", cfg.badge)}>
                        {cfg.label}
                    </span>
                </div>
            </div>

            {/* SAST pills */}
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                        <Bug className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground font-medium">SAST</span>
                    </div>
                    <div className="flex gap-1">
                        {critical > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">C:{critical}</span>}
                        {high > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500">H:{high}</span>}
                        {medium > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600">M:{medium}</span>}
                        {(critical + high + medium) === 0 && scan.status === "completed" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Clean</span>
                        )}
                        {scan.status !== "completed" && <span className="text-[10px] text-muted-foreground">—</span>}
                    </div>
                </div>
                <div className="w-px h-8 bg-border/60 mx-1" />
                {/* Gitleaks pills */}
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground font-medium">Secrets</span>
                    </div>
                    <div className="flex gap-1">
                        {scan.gitleaks_status === "completed" ? (
                            (glCrit + glHigh) > 0 ? (
                                <>
                                    {glCrit > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">C:{glCrit}</span>}
                                    {glHigh > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500">H:{glHigh}</span>}
                                </>
                            ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Clean</span>
                            )
                        ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                    </div>
                </div>
            </div>

            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScanHistoryPage() {
    const { owner, repo } = useParams<{ owner: string; repo: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();

    const [scans, setScans] = useState<ScanRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTriggering, setIsTriggering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [triggerError, setTriggerError] = useState<string | null>(null);

    const repoFullName = `${owner}/${repo}`;

    const fetchScans = useCallback(async () => {
        if (!token) return;
        setError(null);
        try {
            const res = await fetch(`${BACKEND_URL}/api/scans/${owner}/${repo}/history`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setScans(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [token, owner, repo]);

    useEffect(() => {
        fetchScans();
        // Poll every 5s while any scan is running
        const id = setInterval(() => {
            setScans(prev => {
                if (prev.some(s => s.status === "running" || s.status === "queued")) {
                    fetchScans();
                }
                return prev;
            });
        }, 5000);
        return () => clearInterval(id);
    }, [fetchScans]);

    const triggerScan = async () => {
        if (!token) return;
        setIsTriggering(true);
        setTriggerError(null);
        try {
            const res = await fetch(`${BACKEND_URL}/api/scan/${owner}/${repo}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail ?? "Failed to start scan");
            // Navigate to the new scan's detail page immediately
            navigate(`/scan/${owner}/${repo}/${data.scan_id}`);
        } catch (e) {
            setTriggerError((e as Error).message);
            setIsTriggering(false);
        }
    };

    const hasRunning = scans.some(s => s.status === "running" || s.status === "queued");

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/devsecops")}
                        className="h-9 w-9 rounded-xl border bg-card/60 flex items-center justify-center hover:bg-card hover:shadow-sm transition-all"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <GitBranch className="h-5 w-5 text-primary" />
                            <h1 className="text-xl font-bold">{repo}</h1>
                            <a
                                href={`https://github.com/${repoFullName}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{repoFullName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchScans}
                        className="h-9 w-9 rounded-xl border bg-card/60 flex items-center justify-center hover:bg-card transition-all"
                        title="Refresh"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                        onClick={triggerScan}
                        disabled={isTriggering || hasRunning}
                        className={cn(
                            "h-9 px-4 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-md",
                            isTriggering || hasRunning
                                ? "bg-muted text-muted-foreground cursor-not-allowed"
                                : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/20"
                        )}
                    >
                        {isTriggering ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Starting…</>
                        ) : hasRunning ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Scan Running</>
                        ) : (
                            <><Play className="h-4 w-4" />Run New Scan</>
                        )}
                    </button>
                </div>
            </div>

            {triggerError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {triggerError}
                </div>
            )}

            {/* Summary bar */}
            {!isLoading && scans.length > 0 && (
                <div className="flex items-center gap-6 px-5 py-4 rounded-2xl border bg-card/40 backdrop-blur-sm text-sm flex-wrap">
                    <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{scans.length}</span>
                        <span className="text-muted-foreground">total scans</span>
                    </div>
                    <div className="w-px h-5 bg-border" />
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="font-semibold">{scans.filter(s => s.status === "completed").length}</span>
                        <span className="text-muted-foreground">completed</span>
                    </div>
                    {hasRunning && (
                        <>
                            <div className="w-px h-5 bg-border" />
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-blue-500 font-semibold">Scan in progress…</span>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !error && scans.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 border-2 border-dashed rounded-2xl bg-muted/10">
                    <Shield className="h-12 w-12 text-muted-foreground opacity-30" />
                    <div className="text-center">
                        <p className="font-semibold text-lg">No scans yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Run your first scan to detect vulnerabilities and secrets in <strong>{repoFullName}</strong>
                        </p>
                    </div>
                    <button
                        onClick={triggerScan}
                        disabled={isTriggering}
                        className="mt-2 h-10 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md"
                    >
                        <Play className="h-4 w-4" />
                        Run First Scan
                    </button>
                </div>
            )}

            {/* Scan list */}
            {!isLoading && scans.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest px-1">
                        Scan History — click a scan to view findings
                    </p>
                    {scans.map((scan, i) => (
                        <ScanRow
                            key={scan.id}
                            scan={scan}
                            index={i}
                            onClick={() => navigate(`/scan/${owner}/${repo}/${scan.id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
