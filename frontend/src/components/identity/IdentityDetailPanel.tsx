import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    X, AlertTriangle, Fingerprint, Network, Zap, ShieldCheck, ArrowRight, ShieldAlert, Activity, RefreshCcw, Users
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import CopilotChat from "./CopilotChat";
import { useAuth } from "@/contexts/AuthContext";

import type { Identity, IdentityDetail, ComplianceData } from "../../types/identity";

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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const IdentityComplianceSummary = ({ identity }: { identity: Identity }) => {
    const { token } = useAuth();
    const { data: compliance, isLoading } = useQuery<ComplianceData>({
        queryKey: ["identity-compliance", identity.id],
        queryFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/identities/${identity.id}/compliance`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) return null;
            return resp.json();
        },
        enabled: !!token,
    });

    if (isLoading) return <div className="text-[10px] text-muted-foreground italic">Analyzing compliance...</div>;
    if (!compliance) return null;

    return (
        <div className="space-y-2 mt-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Compliance Guardrails</h3>
            <div className="grid grid-cols-2 gap-2">
                {compliance.top_violations.length === 0 ? (
                    <div className="col-span-2 p-2 rounded bg-threat-safe/5 border border-threat-safe/20 flex items-center gap-2">
                        <ShieldCheck className="h-3 w-3 text-threat-safe" />
                        <span className="text-[10px]">Fully compliant with all policies</span>
                    </div>
                ) : (
                    compliance.top_violations.map((v, i) => (
                        <div key={i} className="p-2 rounded bg-threat-critical/5 border border-threat-critical/20 flex items-start gap-2">
                            <AlertTriangle className="h-3 w-3 text-threat-critical shrink-0 mt-0.5" />
                            <span className="text-[9px] leading-tight">{v.message}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default function IdentityDetailPanel({ identity, onClose }: { identity: Identity; onClose: () => void }) {
    const { token } = useAuth();
    const { data: detail, isLoading } = useQuery<IdentityDetail>({
        queryKey: ["identity-detail", identity.id],
        queryFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/identities/${identity.id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) return null;
            return resp.json();
        },
        enabled: !!token,
    });

    const riskFactors = detail?.riskFactors ?? [];
    const attackPaths = detail?.attackPaths ?? [];
    const lateralMovement = detail?.lateralMovement ?? [];
    const remediations = detail?.remediations ?? [];

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-background/40 backdrop-blur-md transition-all">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1"
                onClick={onClose}
            />
            <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="h-full w-full max-w-2xl border-l border-border/20 shadow-2xl flex flex-col bg-card/80 backdrop-blur-2xl"
            >
                <CardHeader className="flex flex-row items-center justify-between bg-muted/30 border-b border-border/10 shrink-0 py-5 px-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                                <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-black tracking-tight">{identity.email}</CardTitle>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border-primary/20">{identity.source}</Badge>
                                    <span className="text-[9px] font-medium text-muted-foreground opacity-60 uppercase tracking-tighter">ID: {identity.id}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all">
                        <X className="h-5 w-5" />
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

                            {/* Compliance Summary (Integrated) */}
                            <IdentityComplianceSummary identity={identity} />

                            {/* Priority Remediation (NEW) */}
                            {remediations.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Priority Remediation</h3>
                                        <Badge variant="outline" className="text-[9px] bg-emerald-400/10 text-emerald-400 border-emerald-400/20">-{detail?.remediations?.[0]?.risk_reduction_score ? detail.remediations[0].risk_reduction_score * 2 : 0}% Risk</Badge>
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
            </motion.div>
        </div>
    );
}
