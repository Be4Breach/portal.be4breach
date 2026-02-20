import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
    Shield,
    AlertTriangle,
    AlertCircle,
    Info,
    CheckCircle2,
    Clock,
    RefreshCw,
    ArrowLeft,
    FileCode2,
    ChevronDown,
    ChevronRight,
    Loader2,
    Play,
    ExternalLink,
    Bug,
    Download,
    Code2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeveritySummary {
    CRITICAL: number;
    ERROR: number;
    WARNING: number;
    INFO: number;
}

interface Scan {
    id: string;
    repo_full_name: string;
    status: "queued" | "running" | "completed" | "failed";
    finding_count: number;
    severity_summary: SeveritySummary;
    created_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    error: string | null;
    semgrep_errors: string[];
}

interface Finding {
    rule_id: string;
    severity: string;
    message: string;
    file_path: string;
    line_start: number | null;
    line_end: number | null;
    code_snippet: string;
    cwe: string[];
    owasp: string[];
    fix: string | null;
}

// ─── Severity config ──────────────────────────────────────────────────────────

const SEV_CONFIG: Record<
    string,
    { label: string; icon: React.ElementType; badge: string; row: string; iconCls: string }
> = {
    CRITICAL: {
        label: "Critical",
        icon: AlertCircle,
        badge: "bg-red-500/10 text-red-500 border-red-500/30",
        row: "border-l-red-500",
        iconCls: "text-red-500",
    },
    ERROR: {
        label: "High",
        icon: AlertTriangle,
        badge: "bg-orange-500/10 text-orange-500 border-orange-500/30",
        row: "border-l-orange-500",
        iconCls: "text-orange-500",
    },
    WARNING: {
        label: "Medium",
        icon: AlertTriangle,
        badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
        row: "border-l-yellow-500",
        iconCls: "text-yellow-500",
    },
    INFO: {
        label: "Info",
        icon: Info,
        badge: "bg-blue-500/10 text-blue-500 border-blue-500/30",
        row: "border-l-blue-400",
        iconCls: "text-blue-400",
    },
};

const getSev = (s: string) => SEV_CONFIG[s?.toUpperCase()] ?? SEV_CONFIG.INFO;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(start: string | null, end: string | null): string {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadJSON(scan: Scan, findings: Finding[]) {
    const payload = {
        scan: {
            id: scan.id,
            repo: scan.repo_full_name,
            status: scan.status,
            scanned_at: scan.completed_at,
            duration: formatDuration(scan.started_at, scan.completed_at),
            finding_count: scan.finding_count,
            severity_summary: scan.severity_summary,
        },
        findings: findings.map((f) => ({
            severity: f.severity,
            rule_id: f.rule_id,
            message: f.message,
            file: f.file_path,
            line: f.line_start,
            cwe: f.cwe,
            owasp: f.owasp,
            code: f.code_snippet || undefined,
            fix: f.fix || undefined,
        })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-${scan.repo_full_name.replace("/", "-")}-${scan.id.slice(-6)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadCSV(scan: Scan, findings: Finding[]) {
    const header = ["Severity", "Rule ID", "Message", "File", "Line", "CWE", "OWASP", "Fix"];
    const rows = findings.map((f) => [
        f.severity,
        f.rule_id,
        `"${f.message.replace(/"/g, '""')}"`,
        f.file_path,
        f.line_start ?? "",
        f.cwe.join("; "),
        f.owasp.join("; "),
        f.fix ? `"${f.fix.replace(/"/g, '""')}"` : "",
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-${scan.repo_full_name.replace("/", "-")}-${scan.id.slice(-6)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Scan["status"] }) {
    const map = {
        queued: { label: "Queued", cls: "bg-muted text-muted-foreground", icon: Clock },
        running: { label: "Scanning…", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30", icon: Loader2 },
        completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
        failed: { label: "Failed", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle },
    };
    const cfg = map[status] ?? map.queued;
    const Icon = cfg.icon;
    return (
        <Badge variant="outline" className={cn("gap-1.5 px-2.5 py-1 text-xs font-medium", cfg.cls)}>
            <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
            {cfg.label}
        </Badge>
    );
}

function SeverityBar({ summary }: { summary: SeveritySummary }) {
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    if (total === 0) return null;
    const segments = [
        { key: "CRITICAL" as const, color: "bg-red-500" },
        { key: "ERROR" as const, color: "bg-orange-500" },
        { key: "WARNING" as const, color: "bg-yellow-500" },
        { key: "INFO" as const, color: "bg-blue-400" },
    ];
    return (
        <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
            {segments.map(({ key, color }) => {
                const pct = (summary[key] / total) * 100;
                if (pct === 0) return null;
                return (
                    <div
                        key={key}
                        className={cn("h-full transition-all", color)}
                        style={{ width: `${pct}%` }}
                        title={`${key}: ${summary[key]}`}
                    />
                );
            })}
        </div>
    );
}

function FindingCard({ finding }: { finding: Finding }) {
    const [open, setOpen] = useState(false);
    const sev = getSev(finding.severity);
    const Icon = sev.icon;
    // Detect & hide erroneous "requires login" snippets that older scans may have stored
    const hasSnippet =
        finding.code_snippet &&
        finding.code_snippet.trim().toLowerCase() !== "requires login";

    return (
        <div
            className={cn(
                "border-l-2 rounded-lg border bg-card transition-all",
                sev.row,
                open ? "shadow-sm" : ""
            )}
        >
            <button
                className="w-full flex items-start gap-3 p-4 text-left"
                onClick={() => setOpen((o) => !o)}
            >
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", sev.iconCls)} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 shrink-0", sev.badge)}>
                            {sev.label}
                        </Badge>
                        <code className="text-[11px] text-muted-foreground font-mono truncate">
                            {finding.rule_id}
                        </code>
                    </div>
                    <p className="text-sm font-medium mt-1 leading-snug">{finding.message}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
                        <FileCode2 className="h-3 w-3 shrink-0" />
                        <span className="truncate font-mono">{finding.file_path}</span>
                        {finding.line_start && (
                            <span className="shrink-0">:{finding.line_start}</span>
                        )}
                    </div>
                </div>
                {open ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                    {/* Code snippet */}
                    {hasSnippet ? (
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Code2 className="h-3 w-3" /> Code snippet
                            </p>
                            <div className="overflow-x-auto rounded-md bg-secondary">
                                <pre className="text-xs p-3 font-mono leading-relaxed whitespace-pre">
                                    {finding.code_snippet}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                            <Code2 className="h-3 w-3" />
                            Code snippet not available for this rule.
                        </p>
                    )}

                    {/* Fix suggestion */}
                    {finding.fix && (
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                                Suggested fix
                            </p>
                            <div className="overflow-x-auto rounded-md bg-emerald-500/5 border border-emerald-500/20">
                                <pre className="text-xs p-3 font-mono leading-relaxed text-emerald-700 dark:text-emerald-400 whitespace-pre">
                                    {finding.fix}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* CWE / OWASP tags */}
                    {(finding.cwe.length > 0 || finding.owasp.length > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                            {finding.cwe.map((c) => (
                                <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono">
                                    {c}
                                </Badge>
                            ))}
                            {finding.owasp.map((o) => (
                                <Badge key={o} variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                    {o}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Parse error block with horizontal scroll
function ParseError({ raw }: { raw: string }) {
    // Try to pretty-print if it looks like JSON
    let display = raw;
    try {
        const parsed = JSON.parse(raw);
        display = JSON.stringify(parsed, null, 2);
    } catch { /* keep as-is */ }

    return (
        <div className="overflow-x-auto rounded-md bg-secondary border border-border/50">
            <pre className="text-[11px] font-mono p-3 whitespace-pre leading-relaxed min-w-0">
                {display}
            </pre>
        </div>
    );
}

// Download dropdown button
function DownloadButton({ scan, findings }: { scan: Scan; findings: Finding[] }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                id="download-results-btn"
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-20 w-36 rounded-lg border bg-popover shadow-lg overflow-hidden">
                        <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-secondary transition-colors flex items-center gap-2"
                            onClick={() => { downloadJSON(scan, findings); setOpen(false); }}
                        >
                            <span className="font-mono text-[10px] bg-muted px-1 rounded">JSON</span>
                            Download JSON
                        </button>
                        <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-secondary transition-colors flex items-center gap-2"
                            onClick={() => { downloadCSV(scan, findings); setOpen(false); }}
                        >
                            <span className="font-mono text-[10px] bg-muted px-1 rounded">CSV</span>
                            Download CSV
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScanPage() {
    const { owner, repo } = useParams<{ owner: string; repo: string }>();
    const { token } = useAuth();
    const navigate = useNavigate();

    const repoFullName = `${owner}/${repo}`;

    const [scan, setScan] = useState<Scan | null>(null);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTriggering, setIsTriggering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterSev, setFilterSev] = useState<string>("all");
    const [filterSearch, setFilterSearch] = useState("");

    const fetchLatest = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(
                `${BACKEND_URL}/api/scan/${owner}/${repo}/latest`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setScan(data.scan);
            setFindings(data.findings ?? []);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [token, owner, repo]);

    const pollResults = useCallback(
        async (scanId: string) => {
            if (!token) return;
            try {
                const res = await fetch(
                    `${BACKEND_URL}/api/scan/${scanId}/results`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (!res.ok) return;
                const data = await res.json();
                setScan(data.scan);
                setFindings(data.findings ?? []);
            } catch { /* silently ignore */ }
        },
        [token]
    );

    useEffect(() => { fetchLatest(); }, [fetchLatest]);

    useEffect(() => {
        if (!scan || !["queued", "running"].includes(scan.status)) return;
        const interval = setInterval(() => pollResults(scan.id), 3000);
        return () => clearInterval(interval);
    }, [scan, pollResults]);

    const triggerScan = async () => {
        if (!token) return;
        setIsTriggering(true);
        setError(null);
        try {
            const res = await fetch(`${BACKEND_URL}/api/scan/${owner}/${repo}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`);
            setScan({
                id: data.scan_id,           // trigger returns scan_id, not id
                repo_full_name: data.repo_full_name,
                status: data.status ?? "queued",
                severity_summary: { CRITICAL: 0, ERROR: 0, WARNING: 0, INFO: 0 },
                finding_count: 0,
                started_at: null,
                completed_at: null,
                semgrep_errors: [],
                error: null,
                created_at: new Date().toISOString(),
            });
            setFindings([]);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsTriggering(false);
        }
    };

    const filtered = findings.filter((f) => {
        if (filterSev !== "all" && f.severity.toUpperCase() !== filterSev) return false;
        if (filterSearch) {
            const q = filterSearch.toLowerCase();
            return (
                f.message.toLowerCase().includes(q) ||
                f.file_path.toLowerCase().includes(q) ||
                f.rule_id.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const isActive = scan && ["queued", "running"].includes(scan.status);
    const summary = scan?.severity_summary ?? { CRITICAL: 0, ERROR: 0, WARNING: 0, INFO: 0 };

    return (
        <div className="space-y-6 max-w-5xl">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                    <button
                        onClick={() => navigate("/repositories")}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to repositories
                    </button>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Security Scan
                    </h1>
                    <div className="flex items-center gap-2">
                        <code className="text-sm text-muted-foreground font-mono">{repoFullName}</code>
                        <a
                            href={`https://github.com/${repoFullName}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {scan?.status === "completed" && findings.length > 0 && (
                        <DownloadButton scan={scan} findings={findings} />
                    )}
                    {scan && <StatusBadge status={scan.status} />}
                    <button
                        id="trigger-scan-btn"
                        onClick={triggerScan}
                        disabled={isTriggering || !!isActive}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isTriggering ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="h-4 w-4" />
                        )}
                        {isActive ? "Scan in progress…" : scan ? "Re-scan" : "Start Scan"}
                    </button>
                </div>
            </div>

            {/* ── Error banner ────────────────────────────────────────────────── */}
            {error && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── Loading ──────────────────────────────────────────────────────── */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* ── No scan yet ──────────────────────────────────────────────────── */}
            {!isLoading && !scan && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 border rounded-xl bg-card">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Shield className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="font-semibold">No scans yet</p>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            Run a Semgrep security scan to detect secrets, vulnerabilities, and misconfigurations.
                        </p>
                    </div>
                    <button
                        onClick={triggerScan}
                        disabled={isTriggering}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {isTriggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Start first scan
                    </button>
                </div>
            )}

            {/* ── Scan in progress ─────────────────────────────────────────────── */}
            {!isLoading && scan && isActive && (
                <div className="rounded-xl border bg-card p-6 flex flex-col items-center gap-4 text-center">
                    <div className="relative">
                        <Shield className="h-12 w-12 text-primary" />
                        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                    </div>
                    <div>
                        <p className="font-semibold">
                            {scan.status === "queued" ? "Scan queued…" : "Scanning repository…"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Cloning repo and running Semgrep analysis. This may take 1–3 minutes.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Auto-refreshing every 3 seconds
                    </div>
                </div>
            )}

            {/* ── Scan failed ──────────────────────────────────────────────────── */}
            {!isLoading && scan?.status === "failed" && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 space-y-2">
                    <div className="flex items-center gap-2 text-destructive font-semibold">
                        <AlertCircle className="h-4 w-4" />
                        Scan failed
                    </div>
                    <p className="text-sm text-muted-foreground">{scan.error}</p>
                    <div className="text-xs text-muted-foreground">
                        Started: {formatTime(scan.started_at)} · Duration: {formatDuration(scan.started_at, scan.completed_at)}
                    </div>
                </div>
            )}

            {/* ── Completed results ─────────────────────────────────────────────── */}
            {!isLoading && scan?.status === "completed" && (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(["CRITICAL", "ERROR", "WARNING", "INFO"] as const).map((sev) => {
                            const cfg = getSev(sev);
                            const Icon = cfg.icon;
                            const count = summary[sev];
                            return (
                                <button
                                    key={sev}
                                    onClick={() => setFilterSev(filterSev === sev ? "all" : sev)}
                                    className={cn(
                                        "flex items-center gap-3 p-4 rounded-xl border bg-card text-left transition-all hover:shadow-sm",
                                        filterSev === sev && "ring-2 ring-primary"
                                    )}
                                >
                                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", cfg.badge)}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold leading-none">{count}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{cfg.label}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Severity bar + meta */}
                    {scan.finding_count > 0 && (
                        <div className="space-y-1.5">
                            <SeverityBar summary={summary} />
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>{scan.finding_count} total findings</span>
                                <span>
                                    Scanned in {formatDuration(scan.started_at, scan.completed_at)} · {formatTime(scan.completed_at)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* No findings */}
                    {scan.finding_count === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 border rounded-xl bg-card">
                            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                            <p className="font-semibold text-emerald-600">No issues found</p>
                            <p className="text-sm text-muted-foreground">
                                Semgrep found no security issues in this repository.
                            </p>
                        </div>
                    )}

                    {/* Findings list */}
                    {scan.finding_count > 0 && (
                        <div className="space-y-4">
                            {/* Filter bar */}
                            <div className="flex gap-3 flex-wrap">
                                <input
                                    placeholder="Search findings…"
                                    value={filterSearch}
                                    onChange={(e) => setFilterSearch(e.target.value)}
                                    className="flex-1 min-w-48 h-9 px-3 rounded-md border bg-secondary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <select
                                    value={filterSev}
                                    onChange={(e) => setFilterSev(e.target.value)}
                                    className="h-9 px-3 pr-8 rounded-md border bg-secondary text-sm appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="all">All severities</option>
                                    <option value="CRITICAL">Critical</option>
                                    <option value="ERROR">High</option>
                                    <option value="WARNING">Medium</option>
                                    <option value="INFO">Info</option>
                                </select>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Showing {filtered.length} of {findings.length} findings
                            </p>

                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                                    <Bug className="h-8 w-8 opacity-30" />
                                    <p className="text-sm">No findings match your filter.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filtered.map((f, i) => (
                                        <FindingCard key={`${f.rule_id}-${f.file_path}-${i}`} finding={f} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Semgrep parse errors ─────────────────────────────────── */}
                    {scan.semgrep_errors.length > 0 && (
                        <details className="border rounded-lg overflow-hidden">
                            <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-muted-foreground hover:bg-secondary/50 transition-colors select-none flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                                {scan.semgrep_errors.length} Semgrep parse warning(s)
                                <span className="text-[10px] opacity-60 ml-auto">Click to expand</span>
                            </summary>
                            <div className="border-t bg-secondary/20 p-4 space-y-3">
                                <p className="text-[11px] text-muted-foreground">
                                    These are non-fatal warnings where Semgrep couldn't fully parse certain files
                                    (e.g. unescaped <code>&amp;</code> in HTML). Findings from other files are unaffected.
                                </p>
                                {scan.semgrep_errors.map((e, i) => (
                                    <ParseError key={i} raw={e} />
                                ))}
                            </div>
                        </details>
                    )}
                </>
            )}
        </div>
    );
}
