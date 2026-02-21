import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ArrowRightCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_MODE } from "@/api/demoConfig";
import { MOCK_REMEDIATIONS } from "@/mocks/identityMockData";

const RemediationView = () => {
    const { token } = useAuth();
    const { data: remediations, isLoading } = useQuery({
        queryKey: ["identity-remediations"],
        queryFn: async () => {
            if (DEMO_MODE) return MOCK_REMEDIATIONS;
            try {
                const resp = await fetch("/api/identity-risk-intelligence/remediations", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!resp.ok) return MOCK_REMEDIATIONS;
                return resp.json();
            } catch (err) {
                console.warn("API Error, falling back to mock:", err);
                return MOCK_REMEDIATIONS;
            }
        },
        enabled: !!token,
    });

    if (isLoading) return <div className="flex justify-center p-12">Loading remediation actions...</div>;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
                <div className="border border-border/50 rounded-lg p-5 bg-card">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Total Actions</p>
                    <p className="text-2xl font-bold">{remediations?.total_actions}</p>
                </div>
                <div className="border border-border/50 rounded-lg p-5 bg-card border-l-4 border-l-threat-critical">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Critical Priority</p>
                    <p className="text-2xl font-bold text-threat-critical">{remediations?.priority_breakdown?.critical}</p>
                </div>
                <div className="border border-border/50 rounded-lg p-5 bg-card border-l-4 border-l-threat-high">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Auto-Remediable</p>
                    <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold">{remediations?.auto_remediable_count}</p>
                        <Zap className="h-4 w-4 text-threat-high fill-threat-high" />
                    </div>
                </div>
                <div className="border border-border/50 rounded-lg p-5 bg-card border-l-4 border-l-threat-safe">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Est. Risk Reduction</p>
                    <p className="text-2xl font-bold text-threat-safe">-{remediations?.estimated_total_risk_reduction}%</p>
                </div>
            </div>

            <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
                    <h3 className="font-semibold">Priority Remediation Backlog</h3>
                    <Button size="sm" variant="outline" className="text-xs gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Execute Managed Batch
                    </Button>
                </div>
                <div className="divide-y divide-border/50">
                    {remediations?.actions?.map((action: any, i: number) => (
                        <div key={i} className="px-6 py-4 flex items-start justify-between hover:bg-muted/10 transition-colors">
                            <div className="flex gap-4">
                                <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${action.priority_level === 'critical' ? 'bg-threat-critical animate-pulse' :
                                    action.priority_level === 'high' ? 'bg-threat-high' : 'bg-threat-medium'
                                    }`} />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm">{action.title}</p>
                                        {action.auto_remediation_possible && (
                                            <span className="text-[10px] bg-threat-safe/10 text-threat-safe px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <Zap className="h-2 w-2 fill-threat-safe" /> Auto
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{action.details}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/50 font-medium">
                                            {action.provider?.toUpperCase()}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{action.email}</span>
                                    </div>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-8 text-xs gap-2 text-muted-foreground hover:text-foreground">
                                View Identity <ArrowRightCircle className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RemediationView;
