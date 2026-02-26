import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

interface PolicyStat {
    name: string;
    category: string;
    identities_affected: number;
    violations: number;
}

interface Violation {
    severity: string;
    email: string;
    message: string;
}

interface ComplianceData {
    compliance_score: number;
    severity_breakdown: Record<string, number>;
    policy_stats: Record<string, PolicyStat>;
    top_violations: Violation[];
}

const ComplianceView = () => {
    const { token } = useAuth();
    const { data: compliance, isLoading } = useQuery<ComplianceData>({
        queryKey: ["identity-compliance"],
        queryFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/compliance`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Failed to fetch compliance data");
            return resp.json();
        },
        enabled: !!token,
    });

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse p-6">
                <div className="grid gap-6 md:grid-cols-3">
                    <div className="h-32 bg-card/40 border border-border/10 rounded-xl" />
                    <div className="md:col-span-2 h-32 bg-card/40 border border-border/10 rounded-xl" />
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="h-64 bg-card/40 border border-border/10 rounded-xl" />
                    <div className="h-64 bg-card/40 border border-border/10 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
                <div className="border border-border/50 rounded-xl p-6 bg-card/60 backdrop-blur-md shadow-lg flex flex-col justify-between">
                    <div>
                        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 opacity-70">Global Compliance Score</h3>
                        <div className="flex items-end gap-3">
                            <span className="text-5xl font-black tracking-tighter bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent">
                                {compliance?.compliance_score}%
                            </span>
                            <div className="mb-2 text-[10px] font-black text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.1)] border border-emerald-500/20">
                                <CheckCircle2 className="h-3 w-3" />
                                LIVE ANALYTICS
                            </div>
                        </div>
                    </div>
                    <div className="mt-6">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2 opacity-60">
                            <span>Efficiency</span>
                            <span>{compliance?.compliance_score}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border/10 shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000"
                                style={{ width: `${compliance?.compliance_score}%`, boxShadow: "0 0 15px rgba(16,185,129,0.3)" }}
                            />
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2 border border-border/50 rounded-xl p-6 bg-card/60 backdrop-blur-md shadow-lg">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 opacity-70">Violation Breakdown by Severity</h3>
                    <div className="flex items-center justify-around h-full pb-6">
                        {Object.entries(compliance?.severity_breakdown || {}).map(([sev, count]) => {
                            const color = sev === 'critical' ? 'text-red-500' : sev === 'high' ? 'text-orange-500' : 'text-amber-500';
                            const bgColor = sev === 'critical' ? 'bg-red-500/10' : sev === 'high' ? 'bg-orange-500/10' : 'bg-amber-500/10';
                            return (
                                <div key={sev} className="flex flex-col items-center group">
                                    <div className={cn("h-16 w-16 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", bgColor)}>
                                        <p className={cn("text-3xl font-black tracking-tighter", color)}>{count}</p>
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{sev}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="border border-border/50 rounded-xl overflow-hidden bg-card/40 backdrop-blur-md shadow-lg flex flex-col">
                    <div className="px-6 py-4 border-b border-border/10 bg-muted/20">
                        <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Compliance Policies</h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {Object.entries(compliance?.policy_stats || {}).map(([key, stat]) => (
                            <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/10 hover:bg-muted/30 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-tight">{stat.name}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground opacity-60 uppercase">{stat.category}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-red-500 uppercase">{stat.identities_affected} Affected</p>
                                    <p className="text-[9px] font-bold text-muted-foreground opacity-60">{stat.violations} Violations</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border border-border/50 rounded-xl overflow-hidden bg-card/40 backdrop-blur-md shadow-lg flex flex-col">
                    <div className="px-6 py-4 border-b border-border/10 bg-muted/20">
                        <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Critical Violations</h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {compliance?.top_violations?.slice(0, 6).map((v, i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all group">
                                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                                    <AlertCircle className="h-4 w-4 text-red-500 group-hover:scale-110 transition-transform" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">{v.severity}</p>
                                        <span className="text-[9px] font-medium text-muted-foreground opacity-40">#{i + 1}</span>
                                    </div>
                                    <p className="text-xs font-black truncate">{v.email}</p>
                                    <p className="text-[11px] text-muted-foreground font-medium mt-1 leading-relaxed opacity-80">{v.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComplianceView;
