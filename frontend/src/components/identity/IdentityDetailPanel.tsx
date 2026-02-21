import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    X, AlertTriangle, Fingerprint, Network, Zap, ShieldCheck, ArrowRight, ShieldAlert, Activity, RefreshCcw
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import CopilotChat from "./CopilotChat";
import { useAuth } from "@/contexts/AuthContext";

interface Identity {
    id: string; email: string; source: string; roles: string[];
    mfaEnabled: boolean; isActive: boolean; riskScore: number;
    privilegeTier: string; exposureLevel: number; attackPathCount: number;
    blastRadius: number; cloudAccounts: string[]; linkedAccounts: string[];
}

function getRiskColor(score: number) {
    if (score >= 80) return "text-threat-critical";
    if (score >= 61) return "text-threat-high";
    if (score >= 31) return "text-threat-medium";
    return "text-threat-safe";
}

function getRiskLabel(score: number) {
    if (score >= 80) return "Critical";
    if (score >= 61) return "High";
    if (score >= 31) return "Medium";
    return "Low";
}

export default function IdentityDetailPanel({ identity, onClose }: { identity: Identity; onClose: () => void }) {
    const { token } = useAuth();
    const { data: detail, isLoading } = useQuery({
        queryKey: ["identity-detail", identity.id],
        queryFn: async () => {
            const resp = await fetch(`/api/identity-risk-intelligence/identities/${identity.id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) return null;
            return resp.json();
        },
        enabled: !!token,
    });

    const riskFactors: string[] = detail?.riskFactors ?? [];
    const attackPaths: any[] = detail?.attackPaths ?? [];
    const lateralMovement: any[] = detail?.lateralMovement ?? [];
    const remediations: any[] = detail?.remediations ?? [];

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-background/80 backdrop-blur-sm">
            <div className="flex-1" onClick={onClose} />
            <Card className="h-full w-full max-w-2xl rounded-none border-l shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col bg-background">
                <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b shrink-0 py-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{identity.email}</CardTitle>
                            <Badge variant="secondary" className="text-[10px] uppercase">{identity.source}</Badge>
                        </div>
                        <CardDescription className="text-[10px] mt-0.5">{identity.id}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-muted/50">
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>

                <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground">
                            <RefreshCcw className="h-8 w-8 animate-spin mb-4 text-primary/40" />
                            <p className="text-sm font-medium">Analyzing identity exposure...</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                            {/* Executive Summary Stats */}
                            <div className="grid grid-cols-4 gap-2">
                                <div className="p-3 rounded-lg border bg-muted/20 text-center">
                                    <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Risk Score</p>
                                    <div className={`text-2xl font-black ${getRiskColor(identity.riskScore)}`}>{identity.riskScore}</div>
                                    <p className={`text-[8px] font-bold mt-1 uppercase ${getRiskColor(identity.riskScore)}`}>{getRiskLabel(identity.riskScore)}</p>
                                </div>
                                <div className="p-3 rounded-lg border bg-muted/20 text-center">
                                    <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Tier</p>
                                    <div className="text-xl font-bold">{identity.privilegeTier}</div>
                                    <ShieldAlert className="h-3 w-3 mx-auto mt-1 text-primary/60" />
                                </div>
                                <div className="p-3 rounded-lg border bg-muted/20 text-center">
                                    <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Exposure</p>
                                    <div className="text-xl font-bold">{Math.round(identity.exposureLevel)}%</div>
                                    <Activity className="h-3 w-3 mx-auto mt-1 text-orange-400" />
                                </div>
                                <div className="p-3 rounded-lg border bg-muted/20 text-center">
                                    <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Blast Radius</p>
                                    <div className="text-xl font-bold">{identity.blastRadius}</div>
                                    <Network className="h-3 w-3 mx-auto mt-1 text-blue-400" />
                                </div>
                            </div>

                            {/* Status Indicators */}
                            <div className="flex gap-2">
                                <div className={cn("flex-1 p-2 rounded-md border flex items-center gap-2", identity.mfaEnabled ? "bg-threat-safe/5 border-threat-safe/20" : "bg-threat-critical/5 border-threat-critical/20")}>
                                    <Fingerprint className={cn("h-4 w-4", identity.mfaEnabled ? "text-threat-safe" : "text-threat-critical")} />
                                    <span className="text-xs font-semibold">{identity.mfaEnabled ? "MFA Protected" : "NO MFA ENABLED"}</span>
                                </div>
                                <div className={cn("flex-1 p-2 rounded-md border flex items-center gap-2", identity.isActive ? "bg-threat-safe/5 border-threat-safe/20" : "bg-threat-medium/5 border-threat-medium/20")}>
                                    <Activity className={cn("h-4 w-4", identity.isActive ? "text-threat-safe" : "text-threat-medium")} />
                                    <span className="text-xs font-semibold">{identity.isActive ? "Account Active" : "Account Dormant"}</span>
                                </div>
                            </div>

                            {/* Priority Remediation (NEW) */}
                            {remediations.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Priority Remediation</h3>
                                        <Badge variant="outline" className="text-[9px] bg-emerald-400/10 text-emerald-400 border-emerald-400/20">-{detail?.remediations?.[0]?.risk_reduction_score * 2}% Risk</Badge>
                                    </div>
                                    <div className="space-y-2">
                                        {remediations.slice(0, 2).map((r, i) => (
                                            <div key={i} className="p-3 rounded-lg border border-primary/20 bg-primary/5 relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 p-2 opacity-20 transition-opacity group-hover:opacity-40">
                                                    <Zap className="h-12 w-12 text-primary fill-primary" />
                                                </div>
                                                <div className="relative z-10 flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                                        <p className="text-xs font-bold">{r.title}</p>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground pr-8">{r.details}</p>
                                                    <Button size="sm" variant="link" className="h-auto p-0 w-fit text-[10px] font-bold text-primary mt-1 gap-1">
                                                        Execute Fix <ArrowRight className="h-2 w-2" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Risk Factors */}
                            {riskFactors.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Threat Intelligence</h3>
                                    <div className="grid gap-2">
                                        {riskFactors.map((f, i) => (
                                            <div key={i} className="flex gap-2 p-2 rounded-md bg-muted/30 border border-border/50 text-[11px]">
                                                <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                                                <span>{f}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Attack Paths / Lateral Movement (NEW) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Escalation Paths ({attackPaths.length})</h3>
                                    <div className="space-y-1.5 min-h-[100px] border rounded-lg p-2 bg-muted/10">
                                        {attackPaths.slice(0, 3).map((p, i) => (
                                            <div key={i} className="text-[10px] p-1.5 rounded bg-muted/30 border border-border/30 flex items-center justify-between">
                                                <span className="truncate max-w-[80px]">{p[1]?.email || "Admin"}</span>
                                                <Badge className="text-[8px] h-4" variant="outline">{p.length - 1} Hops</Badge>
                                            </div>
                                        ))}
                                        {attackPaths.length === 0 && <p className="text-[10px] text-muted-foreground p-2 italic">No escalation paths detected</p>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lateral Potential</h3>
                                    <div className="space-y-1.5 min-h-[100px] border rounded-lg p-2 bg-muted/10">
                                        {lateralMovement.slice(0, 3).map((p, i) => (
                                            <div key={i} className="text-[10px] p-1.5 rounded bg-muted/30 border border-border/30">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="font-bold uppercase text-[9px]">{p.to.source} Jump</span>
                                                    <ArrowRight className="h-2 w-2" />
                                                </div>
                                                <p className="truncate text-muted-foreground italic">{p.to.email}</p>
                                            </div>
                                        ))}
                                        {lateralMovement.length === 0 && <p className="text-[10px] text-muted-foreground p-2 italic">Low lateral risk profile</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Role Hierarchy */}
                            <div className="space-y-2">
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Effective Role Scope</h3>
                                <div className="flex flex-wrap gap-1">
                                    {identity.roles.map((r, i) => (
                                        <Badge key={i} variant="outline" className="text-[9px] bg-muted/10">{r}</Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Copilot Chat (Integrated) */}
                            <div className="pt-4 border-t border-border/50">
                                <CopilotChat contextIdentityId={identity.id} />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
