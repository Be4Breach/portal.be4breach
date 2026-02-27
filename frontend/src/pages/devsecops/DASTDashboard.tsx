import { Globe, Bug, AlertCircle, Shield, Target, AlertTriangle, Clock, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHeader, StatCard, scoreColor, VulnRow, MiniBar, timeAgo } from "./Shared";

const dastData = {
    score: 71,
    total: 24,
    critical: 1,
    high: 4,
    medium: 12,
    low: 7,
    lastScan: "2025-01-15T10:30:00Z",
    target: "https://api.be4breach.com",
    topVulns: [
        { sev: "CRITICAL", name: "SQL Injection", detail: "/api/users?id= — confirmed injectable parameter" },
        { sev: "HIGH", name: "Missing CSP Header", detail: "Content-Security-Policy not present on app shell" },
        { sev: "HIGH", name: "CORS Misconfiguration", detail: "Wildcard origin allowed with credentials" },
        { sev: "HIGH", name: "JWT None Algorithm", detail: "Bearer tokens accept 'none' alg in /api/auth" },
        { sev: "MEDIUM", name: "Clickjacking", detail: "X-Frame-Options header missing on login page" },
        { sev: "MEDIUM", name: "Information Disclosure", detail: "Stack traces exposed in error responses" },
    ],
};

export default function DASTDashboard() {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            <SectionHeader
                icon={Globe}
                title="Dynamic Application Security Testing"
                subtitle="Runtime vulnerability scanning for APIs, web apps, and live environments"
                color="text-blue-500"
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Issues" value={dastData.total} sub="runtime detected" icon={Bug} iconCls="bg-red-500/10 text-red-500" trend="3 fixed this week" trendUp={true} />
                <StatCard title="Critical/High" value={dastData.critical + dastData.high} sub="needs immediate fix" icon={AlertCircle} iconCls="bg-orange-500/10 text-orange-500" />
                <StatCard title="Target APIs" value="1 App" sub="REST API + Web App" icon={Globe} iconCls="bg-blue-500/10 text-blue-500" />
                <StatCard title="DAST Score" value={`${dastData.score}/100`} sub={scoreColor(dastData.score).label} icon={Shield} iconCls="bg-blue-500/10 text-blue-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-blue-500" />
                            Runtime Security Findings
                        </h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-widest bg-secondary px-2 py-1 rounded-md">
                            <Clock className="h-3 w-3" />
                            {timeAgo(dastData.lastScan)}
                        </div>
                    </div>
                    <div className="space-y-1">
                        {dastData.topVulns.map((v, i) => (
                            <VulnRow key={i} sev={v.sev} name={v.name} detail={v.detail} />
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm">
                        <h3 className="text-sm font-semibold mb-5 flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" />
                            Scan Target Profile
                        </h3>
                        <div className="space-y-4">
                            {[
                                { label: "Target URL", value: dastData.target, highlight: true },
                                { label: "Scan Time", value: new Date(dastData.lastScan).toLocaleString(), fontMono: true },
                                { label: "Scanner", value: "OWASP ZAP / Burp Suite Framework" },
                                { label: "Coverage Reach", value: "REST API + Web App" },
                                { label: "Auth Flow", value: "JWT Bearer Flow" },
                            ].map(({ label, value, highlight, fontMono }) => (
                                <div key={label} className="flex items-center justify-between text-xs border-b border-border/40 pb-3 last:border-0 hover:bg-muted/10 px-1 -mx-1 transition-colors rounded">
                                    <span className="text-muted-foreground font-medium">{label}</span>
                                    <span className={`font-semibold text-right max-w-[60%] truncate ${highlight ? "text-primary bg-primary/10 px-2 py-0.5 rounded-md" : ""} ${fontMono ? "font-mono text-[10px]" : ""}`}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm">
                        <h3 className="text-sm font-semibold mb-5 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Severity Distribution
                        </h3>
                        <div className="space-y-4">
                            <MiniBar label="Critical" value={dastData.critical} max={dastData.total} color="bg-red-500" />
                            <MiniBar label="High" value={dastData.high} max={dastData.total} color="bg-orange-500" />
                            <MiniBar label="Medium" value={dastData.medium} max={dastData.total} color="bg-yellow-500" />
                            <MiniBar label="Low" value={dastData.low} max={dastData.total} color="bg-blue-400" />
                        </div>
                        <div className="mt-6 pt-4 border-t border-border/50">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest border-blue-500/30 text-blue-500 bg-blue-500/10 px-3 py-1">
                                Scheduled DAST Scan Enabled
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
