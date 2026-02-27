import { Package, Bug, AlertCircle, Shield, AlertTriangle, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHeader, StatCard, scoreColor, VulnRow, ScoreRing, MiniBar } from "./Shared";

const scaData = {
    score: 55,
    total: 47,
    critical: 3,
    high: 11,
    medium: 18,
    low: 15,
    packages: 284,
    outdated: 32,
    topVulns: [
        { sev: "CRITICAL", name: "lodash < 4.17.21", detail: "Prototype Pollution · CVE-2021-23337" },
        { sev: "CRITICAL", name: "axios < 1.6.0", detail: "SSRF via redirect · CVE-2023-45857" },
        { sev: "CRITICAL", name: "jsonwebtoken < 9.0.0", detail: "Weak asymmetric key · CVE-2022-23529" },
        { sev: "HIGH", name: "express < 4.19.2", detail: "Open Redirect · CVE-2024-29041" },
        { sev: "HIGH", name: "semver < 7.5.2", detail: "ReDoS vulnerability · CVE-2022-25883" },
        { sev: "MEDIUM", name: "minimist < 1.2.6", detail: "Prototype Pollution · CVE-2021-44906" },
    ],
};

export default function SCADashboard() {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            <SectionHeader
                icon={Package}
                title="Software Composition Analysis"
                subtitle="Detect vulnerabilities in open-source dependencies and third-party libraries"
                color="text-orange-500"
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Vulns" value={scaData.total} sub="across all deps" icon={Bug} iconCls="bg-red-500/10 text-red-500" trend="8 new this week" trendUp={false} />
                <StatCard title="Critical/High" value={scaData.critical + scaData.high} sub="require immediate fix" icon={AlertCircle} iconCls="bg-orange-500/10 text-orange-500" />
                <StatCard title="Total Packages" value={scaData.packages} sub={`${scaData.outdated} outdated`} icon={Package} iconCls="bg-blue-500/10 text-blue-500" />
                <StatCard title="SCA Score" value={`${scaData.score}/100`} sub={scoreColor(scaData.score).label} icon={Shield} iconCls="bg-orange-500/10 text-orange-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm">
                    <h3 className="text-sm font-semibold mb-5 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Top Vulnerability Findings
                    </h3>
                    <div className="space-y-1">
                        {scaData.topVulns.map((v, i) => (
                            <VulnRow key={i} sev={v.sev} name={v.name} detail={v.detail} />
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 flex flex-col gap-6 shadow-sm">
                    <div>
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Severity Distribution
                        </h3>
                        <div className="flex justify-center my-6">
                            <ScoreRing score={scaData.score} size={120} />
                        </div>
                        <div className="space-y-4">
                            <MiniBar label="Critical" value={scaData.critical} max={scaData.total} color="bg-red-500" />
                            <MiniBar label="High" value={scaData.high} max={scaData.total} color="bg-orange-500" />
                            <MiniBar label="Medium" value={scaData.medium} max={scaData.total} color="bg-yellow-500" />
                            <MiniBar label="Low" value={scaData.low} max={scaData.total} color="bg-blue-400" />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border/50 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">Scanning Engine</span>
                            <span className="font-semibold text-foreground bg-secondary px-2 py-1 rounded-md">OWASP Dependency-Check</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">Integration Status</span>
                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5 px-2 py-0 h-5">
                                Active Module
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
