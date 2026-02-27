import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, GitCommit, Search, Plus, Code2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import BACKEND_URL from "@/lib/api";
import { scoreColor, timeAgo } from "./Shared";

async function fetchScanHistory(token: string) {
    const res = await fetch(`${BACKEND_URL}/api/scans/history`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    return res.json();
}

export default function OverviewDashboard() {
    const navigate = useNavigate();
    const { token, hasGitHub } = useAuth();
    const [search, setSearch] = useState("");

    const { data: scans = [], isLoading } = useQuery({
        queryKey: ["scan-history-overview"],
        queryFn: () => fetchScanHistory(token!),
        enabled: !!token && hasGitHub,
    });

    // Group scans by repo to get the latest scan per repo
    const latestScansByRepo = new Map<string, any>();
    for (const scan of scans) {
        if (!latestScansByRepo.has(scan.repo_full_name)) {
            latestScansByRepo.set(scan.repo_full_name, scan);
        }
    }

    const displayProjects = Array.from(latestScansByRepo.values()).map((scan: any) => {
        // Simple mock score calculation: 100 - (critical * 10) - (high * 5) - (medium * 2)
        const critical = scan.severity_summary?.CRITICAL || 0;
        const high = scan.severity_summary?.ERROR || scan.severity_summary?.HIGH || 0;
        const medium = scan.severity_summary?.WARNING || scan.severity_summary?.MEDIUM || 0;
        let score = 100 - (critical * 10) - (high * 5) - (medium * 2);
        if (score < 0) score = 0;

        return {
            id: scan.id,
            name: scan.repo_full_name,
            lastDeploy: scan.completed_at || scan.created_at,
            score: score,
            vulns: { critical, high, medium },
            status: scan.status,
        };
    });

    // Filter by search query (matches repo name or owner)
    const filteredProjects = search.trim()
        ? displayProjects.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase())
        )
        : displayProjects;

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1 text-left">
                    <h2 className="text-2xl font-bold bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">Scanned Projects</h2>
                    <p className="text-sm text-muted-foreground">Monitor and manage your repository security posture.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            placeholder="Find a project..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-10 pl-9 pr-4 rounded-xl border bg-card/50 backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => navigate("/devsecops/repositories")}
                        className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md hover:shadow-primary/20"
                    >
                        <Plus className="h-4 w-4" />
                        Add New Project
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProjects.map((proj) => {
                    const color = scoreColor(proj.score);
                    return (
                        <div key={proj.id} className="group relative flex flex-col rounded-2xl border bg-card/40 backdrop-blur-xl p-6 shadow-sm hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-secondary to-muted border shadow-inner flex items-center justify-center">
                                        <Code2 className="h-6 w-6 text-foreground/80" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-base truncate max-w-[150px]">{proj.name.split("/")[1]}</span>
                                        <span className="text-xs text-muted-foreground font-mono">{proj.name.split("/")[0]}</span>
                                    </div>
                                </div>
                                <div className={`flex items-center justify-center p-2 rounded-lg border ${color.bg}/10 ${color.ring.replace("stroke", "border")}`}>
                                    <span className={`text-base font-bold ${color.text} tabular-nums leading-none`}>{proj.score}</span>
                                </div>
                            </div>

                            {/* Vulns Overview */}
                            <div className="flex gap-2 mb-6 bg-secondary/30 p-3 rounded-xl">
                                <span className="flex-1 text-center border-r last:border-0 border-border/50">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Crit</p>
                                    <p className="text-base font-bold text-red-500">{proj.vulns.critical}</p>
                                </span>
                                <span className="flex-1 text-center border-r last:border-0 border-border/50">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">High</p>
                                    <p className="text-base font-bold text-orange-500">{proj.vulns.high}</p>
                                </span>
                                <span className="flex-1 text-center border-r last:border-0 border-border/50">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Med</p>
                                    <p className="text-base font-bold text-yellow-500">{proj.vulns.medium}</p>
                                </span>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-border/50">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <GitCommit className="h-3.5 w-3.5" />
                                    {timeAgo(proj.lastDeploy)}
                                </span>
                                <button
                                    onClick={() => navigate(`/scan/${proj.name}`)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold hover:bg-primary hover:text-primary-foreground transition-all"
                                >
                                    <Shield className="h-3.5 w-3.5" />
                                    Security Posture
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* No match after searching */}
            {!isLoading && displayProjects.length > 0 && filteredProjects.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Search className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No projects match <strong>"{search}"</strong>.</p>
                    <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline">Clear search</button>
                </div>
            )}
            {!isLoading && displayProjects.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                    <Shield className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-bold mb-2">No Projects Scanned Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-6">
                        {hasGitHub ? "Start by adding a new repository to enable continuous security monitoring and comprehensive DevSecOps tracking." : "Link your GitHub account in Settings to enable scanning across your repositories."}
                    </p>
                    <button
                        onClick={() => navigate(hasGitHub ? "/devsecops/repositories" : "/settings")}
                        className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-md"
                    >
                        {hasGitHub ? "Add New Project" : "Connect GitHub"}
                    </button>
                </div>
            )}
            {isLoading && (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            )}
        </div>
    );
}
