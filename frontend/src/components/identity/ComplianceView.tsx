import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_MODE } from "@/api/demoConfig";
import { MOCK_COMPLIANCE } from "@/mocks/identityMockData";

const ComplianceView = () => {
    const { token } = useAuth();
    const { data: compliance, isLoading } = useQuery({
        queryKey: ["identity-compliance"],
        queryFn: async () => {
            if (DEMO_MODE) return MOCK_COMPLIANCE;
            try {
                const resp = await fetch("/api/identity-risk-intelligence/compliance", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!resp.ok) return MOCK_COMPLIANCE;
                return resp.json();
            } catch (err) {
                console.warn("API Error, falling back to mock:", err);
                return MOCK_COMPLIANCE;
            }
        },
        enabled: !!token,
    });

    if (isLoading) return <div className="flex justify-center p-12">Loading compliance data...</div>;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <div className="border border-border/50 rounded-lg p-6 bg-card text-card-foreground shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">Global Compliance Score</h3>
                    <div className="flex items-end gap-3">
                        <span className="text-4xl font-bold tracking-tight">{compliance?.compliance_score}%</span>
                        <div className="mb-1 text-xs font-medium text-threat-safe flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            +2.4% from last audit
                        </div>
                    </div>
                    <Progress value={compliance?.compliance_score} className="h-1.5 mt-4" />
                </div>

                <div className="md:col-span-2 border border-border/50 rounded-lg p-6 bg-card shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">Violation Breakdown by Severity</h3>
                    <div className="flex items-center gap-8">
                        {Object.entries(compliance?.severity_breakdown || {}).map(([sev, count]) => (
                            <div key={sev} className="text-center">
                                <p className="text-2xl font-bold">{count as number}</p>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{sev}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-border/50 rounded-lg p-6 bg-card">
                    <h3 className="text-base font-semibold mb-4">Compliance Policies</h3>
                    <div className="space-y-4">
                        {Object.entries(compliance?.policy_stats || {}).map(([key, stat]: [string, any]) => (
                            <div key={key} className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-border/30">
                                <div>
                                    <p className="text-sm font-medium">{stat.name}</p>
                                    <p className="text-[11px] text-muted-foreground">{stat.category}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-threat-critical">{stat.identities_affected} Affected</p>
                                    <p className="text-[10px] text-muted-foreground">{stat.violations} Violations</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border border-border/50 rounded-lg p-6 bg-card">
                    <h3 className="text-base font-semibold mb-4">Critical Violations</h3>
                    <div className="space-y-3">
                        {compliance?.top_violations?.slice(0, 6).map((v: any, i: number) => (
                            <div key={i} className="flex gap-3 p-3 rounded-md bg-threat-critical/5 border border-threat-critical/20">
                                <AlertCircle className="h-4 w-4 text-threat-critical shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-semibold text-threat-critical uppercase tracking-tighter">{v.severity}</p>
                                    <p className="text-sm font-medium mt-0.5">{v.email}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{v.message}</p>
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
