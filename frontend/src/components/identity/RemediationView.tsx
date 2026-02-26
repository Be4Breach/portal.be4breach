import { useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
// import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

interface RemediationAction {
    priority_level: string;
    title: string;
    auto_remediation_possible: boolean;
    details: string;
    provider?: string;
    email: string;
}

interface RemediationData {
    total_actions: number;
    priority_breakdown: Record<string, number>;
    auto_remediable_count: number;
    estimated_total_risk_reduction: number;
    actions: RemediationAction[];
}

const RemediationView = () => {
    const { token } = useAuth();
    const { data: remediations, isLoading } = useQuery<RemediationData>({
        queryKey: ["identity-remediations"],
        queryFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/remediations`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Failed to fetch remediation actions");
            return resp.json();
        },
        enabled: !!token,
    });

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse p-6">
                <div className="grid gap-6 md:grid-cols-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-20 bg-card/40 border border-border/10 rounded-xl" />
                    ))}
                </div>
                <div className="h-96 bg-card/40 border border-border/10 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-4">
                <div className="border border-border/50 rounded-2xl p-6 bg-card/60 backdrop-blur-md shadow-lg transition-all hover:-translate-y-1 group">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 opacity-60">Total Actions</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black tracking-tighter group-hover:text-primary transition-colors">{remediations?.total_actions}</p>
                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase">Backlog</span>
                    </div>
                </div>
                <div className="border border-border/50 rounded-2xl p-6 bg-card/60 backdrop-blur-md shadow-lg border-l-4 border-l-red-500/50 transition-all hover:-translate-y-1 group">
                    <p className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em] mb-3">Critical Priority</p>
                    <p className="text-3xl font-black tracking-tighter text-red-500">{remediations?.priority_breakdown?.critical}</p>
                </div>
                <div className="border border-border/50 rounded-2xl p-6 bg-card/60 backdrop-blur-md shadow-lg border-l-4 border-l-orange-500/50 transition-all hover:-translate-y-1 group">
                    <p className="text-[10px] font-black text-orange-500/60 uppercase tracking-[0.2em] mb-3">Auto-Remediable</p>
                    <div className="flex items-center gap-3">
                        <p className="text-3xl font-black tracking-tighter">{remediations?.auto_remediable_count}</p>
                        <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <Zap className="h-4 w-4 text-orange-500 fill-orange-500" />
                        </div>
                    </div>
                </div>
                <div className="border border-border/50 rounded-2xl p-6 bg-card/60 backdrop-blur-md shadow-lg border-l-4 border-l-emerald-500/50 transition-all hover:-translate-y-1 group">
                    <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.2em] mb-3">Risk Reduction</p>
                    <p className="text-3xl font-black tracking-tighter text-emerald-500">-{remediations?.estimated_total_risk_reduction}%</p>
                </div>
            </div>

            <div className="border border-border/10 rounded-2xl bg-card/60 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col">
                <div className="px-8 py-5 border-b border-border/10 flex items-center justify-between bg-muted/20">
                    <div>
                        <h3 className="text-sm font-black text-muted-foreground uppercase tracking-[0.2em]">Priority Remediation Backlog</h3>
                        <p className="text-[10px] font-bold text-muted-foreground/40 mt-1 uppercase">Recommended security controls for identity exposure</p>
                    </div>
                    {/* <Button size="sm" className="h-10 px-6 text-[11px] font-black uppercase tracking-widest gap-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                        <CheckCircle2 className="h-4 w-4" /> Execute Batch
                    </Button> */}
                </div>
                <div className="divide-y divide-border/5">
                    {remediations?.actions?.map((action, i) => (
                        <div key={i} className="px-8 py-5 flex items-center justify-between hover:bg-muted/30 transition-all group">
                            <div className="flex gap-6 items-center">
                                <div className={cn(
                                    "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner border border-border/10",
                                    action.priority_level === 'critical' ? 'bg-red-500/10' :
                                        action.priority_level === 'high' ? 'bg-orange-500/10' : 'bg-amber-500/10'
                                )}>
                                    <div className={cn(
                                        "h-3 w-3 rounded-full",
                                        action.priority_level === 'critical' ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                                            action.priority_level === 'high' ? 'bg-orange-500' : 'bg-amber-500'
                                    )} />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <p className="font-black text-sm tracking-tight group-hover:text-primary transition-colors">{action.title}</p>
                                        {action.auto_remediation_possible && (
                                            <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1 uppercase tracking-widest shadow-sm">
                                                <Zap className="h-2.5 w-2.5 fill-emerald-500" /> Auto
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium text-muted-foreground opacity-70 pr-12 line-clamp-1">{action.details}</p>
                                    <div className="flex items-center gap-4 mt-2">
                                        {/* <span className="text-[9px] font-black px-2 py-0.5 rounded border border-border/10 bg-muted/40 uppercase tracking-widest opacity-60">
                                            {action.provider?.toUpperCase()}
                                        </span> */}
                                        <span className="text-[10px] font-bold text-muted-foreground/40">{action.email}</span>
                                    </div>
                                </div>
                            </div>
                            {/* <Button variant="outline" size="sm" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 border-border/40 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all rounded-lg shadow-sm">
                                View Profile <ArrowRightCircle className="h-3.5 w-3.5" />
                            </Button> */}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RemediationView;
