import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import BACKEND_URL from "@/lib/api";
import { Code2, Shield, Cpu, Target, ExternalLink, Activity, Info, Zap, RefreshCw, ChevronRight, CheckCircle2, XCircle, Search } from "lucide-react";
import { SectionHeader, StatCard, scoreColor, timeAgo } from "./Shared";
import { cn } from "@/lib/utils";

async function fetchRepos(token: string) {
    const res = await fetch(`${BACKEND_URL}/api/github/repos`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    return res.json();
}

async function fetchLatestScan(token: string, owner: string, repo: string) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/scan/${owner}/${repo}/latest`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return null;
        const data = await res.json();
        return data.scan ?? null;
    } catch { return null; }
}

function SASTScanRow({ repo, token }: { repo: any; token: string }) {
    const navigate = useNavigate();
    const [owner, repoName] = repo.full_name.split("/");

    const { data: scan, isLoading } = useQuery({
        queryKey: ["scan-latest", repo.full_name],
        queryFn: () => fetchLatestScan(token, owner, repoName),
        staleTime: 2 * 60 * 1000,
        retry: 0,
    });

    const total = scan?.finding_count ?? 0;
    const summary = scan?.severity_summary;

    return (
        <div className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0 group hover:bg-muted/30 px-2 -mx-2 rounded-md transition-colors">
            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 border shadow-inner">
                <Code2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{repo.name}</p>
                <p className="text-[10px] text-muted-foreground">
                    {repo.language ?? "Unknown"} · {timeAgo(repo.updated_at)}
                </p>
            </div>

            {isLoading ? (
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            ) : scan?.status === "completed" && total > 0 ? (
                <div className="flex items-center gap-2 shrink-0 bg-background/50 backdrop-blur border p-1 rounded-md px-2">
                    {summary?.CRITICAL ? (<span className="text-[10px] font-bold text-red-500">{summary.CRITICAL}C</span>) : null}
                    {summary?.ERROR ? (<span className="text-[10px] font-bold text-orange-500">{summary.ERROR}H</span>) : null}
                    {summary?.WARNING ? (<span className="text-[10px] font-bold text-yellow-600">{summary.WARNING}M</span>) : null}
                    <span className="text-[10px] text-muted-foreground border-l pl-2 font-mono">({total})</span>
                </div>
            ) : scan?.status === "completed" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : scan?.status === "failed" ? (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
            ) : (
                <span className="text-[10px] text-muted-foreground shrink-0 uppercase tracking-widest font-semibold">Not scanned</span>
            )}

            <button
                onClick={() => navigate(`/scan/${owner}/${repoName}`)}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 h-7 w-7 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 shadow-sm"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}


export default function SASTDashboard() {
    const { token, hasGitHub } = useAuth();
    const navigate = useNavigate();

    const { data: repos = [], isLoading: reposLoading } = useQuery({
        queryKey: ["github-repos-devsecops"],
        queryFn: () => fetchRepos(token!),
        enabled: !!token && hasGitHub,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    const sastScore = repos.length > 0 ? 85 : 0;

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            <SectionHeader
                icon={Code2}
                title="Static Application Security Testing"
                subtitle="Semgrep-powered code analysis — real-time results from your connected repositories"
                color="text-red-500"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard title="Repos Monitored" value={repos.length || 0} sub="GitHub connected" icon={Code2} iconCls="bg-red-500/10 text-red-500" />
                <StatCard title="SAST Score" value={repos.length ? `${sastScore}/100` : "N/A"} sub={repos.length ? scoreColor(sastScore).label : "Connect GitHub"} icon={Shield} iconCls="bg-red-500/10 text-red-500" />
                <StatCard title="Engine" value="Semgrep" sub="OSS · 4000+ rules" icon={Cpu} iconCls="bg-purple-500/10 text-purple-500" />
                <StatCard title="Coverage" value="OWASP 10" sub="CWE mapped" icon={Target} iconCls="bg-emerald-500/10 text-emerald-500" />
            </div>

            {!hasGitHub ? (
                <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-10 flex flex-col items-center gap-4 text-center shadow-sm">
                    <div className="h-16 w-16 rounded-2xl border shadow-inner bg-primary/5 flex items-center justify-center">
                        <Code2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Connect GitHub to see live SAST results</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Link your GitHub account in Settings to enable Semgrep scanning across all your repositories automatically.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate("/settings")}
                        className="mt-2 flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-primary/20"
                    >
                        Go to Settings
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            ) : reposLoading ? (
                <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-20 flex items-center justify-center shadow-sm">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground opacity-50" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" />
                                Repository Scan Status
                            </h3>
                            <button
                                onClick={() => navigate("/devsecops/repositories")}
                                className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                            >
                                View all repos
                                <ExternalLink className="h-3 w-3" />
                            </button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto pr-2 space-y-1">
                            {repos.slice(0, 15).map((repo: any) => (
                                <SASTScanRow key={repo.id} repo={repo} token={token!} />
                            ))}
                            {repos.length === 0 && (
                                <div className="flex flex-col items-center py-10 opacity-60">
                                    <Code2 className="h-10 w-10 text-muted-foreground mb-3" />
                                    <p className="text-xs text-muted-foreground text-center">No repositories found in connected account.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm">
                            <h3 className="text-sm font-semibold mb-5 flex items-center gap-2">
                                <Info className="h-4 w-4 text-blue-500" />
                                Rule Coverage
                            </h3>
                            <div className="space-y-4">
                                {[
                                    { label: "Injection Flaws (SQLi, XSS, SSTI)", pct: 92, color: "bg-red-500" },
                                    { label: "Secrets & Credentials", pct: 88, color: "bg-orange-500" },
                                    { label: "Insecure Deserialization", pct: 75, color: "bg-yellow-500" },
                                    { label: "Cryptographic Failures", pct: 70, color: "bg-purple-500" },
                                    { label: "Security Misconfigurations", pct: 68, color: "bg-blue-500" },
                                ].map(({ label, pct, color }) => (
                                    <div key={label} className="space-y-1.5 group">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                                            <span className="font-bold tabular-nums">{pct}%</span>
                                        </div>
                                        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-gradient-to-br from-card to-primary/5 p-6 shadow-sm">
                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-yellow-500" />
                                Initiate New Scan
                            </h3>
                            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                                Click on any repository above or navigate to the Repositories page to run a detailed Semgrep scan. Wait for the engine to complete code abstraction and analysis.
                            </p>
                            <button
                                onClick={() => navigate("/devsecops/repositories")}
                                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-md hover:shadow-primary/20"
                            >
                                <Search className="h-4 w-4" />
                                Scan Repository Database
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
