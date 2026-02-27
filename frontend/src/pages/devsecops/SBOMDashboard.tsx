import { Layers, Package, Database, Shield, FileText, Lock, FileCode2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SectionHeader, StatCard, scoreColor, MiniBar } from "./Shared";

const sbomData = {
    score: 78,
    totalComponents: 284,
    directDeps: 62,
    transitiveDeps: 222,
    licenses: {
        MIT: 148,
        Apache2: 67,
        BSD: 29,
        GPL: 8,
        Other: 32,
    },
    recentComponents: [
        { name: "react", version: "18.3.1", license: "MIT", risk: "low" },
        { name: "typescript", version: "5.5.4", license: "Apache-2.0", risk: "low" },
        { name: "fastapi", version: "0.111.0", license: "MIT", risk: "low" },
        { name: "pydantic", version: "2.7.4", license: "MIT", risk: "low" },
        { name: "cryptography", version: "42.0.5", license: "Apache-2.0", risk: "medium" },
        { name: "paramiko", version: "3.4.0", license: "LGPL", risk: "medium" },
    ],
};

export default function SBOMDashboard() {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            <SectionHeader
                icon={Layers}
                title="Software Bill of Materials"
                subtitle="Complete inventory of all software components, dependencies, and licenses in your supply chain"
                color="text-emerald-500"
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Components" value={sbomData.totalComponents} sub="direct + transitive" icon={Layers} iconCls="bg-emerald-500/10 text-emerald-500" />
                <StatCard title="Direct Deps" value={sbomData.directDeps} sub="first-party imports" icon={Package} iconCls="bg-blue-500/10 text-blue-500" />
                <StatCard title="Transitive Deps" value={sbomData.transitiveDeps} sub="indirect dependencies" icon={Database} iconCls="bg-purple-500/10 text-purple-500" />
                <StatCard title="Supply Chain Score" value={`${sbomData.score}/100`} sub={scoreColor(sbomData.score).label} icon={Shield} iconCls="bg-emerald-500/10 text-emerald-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm">
                    <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
                        <Package className="h-4 w-4 text-emerald-500" />
                        Component Inventory Top Assets
                    </h3>
                    <div className="space-y-0 relative">
                        <div className="grid grid-cols-3 text-[10px] text-muted-foreground uppercase tracking-wider pb-3 border-b border-border/50 font-bold">
                            <span>Component Name</span>
                            <span>Semantic Version</span>
                            <span>License / Risk Profile</span>
                        </div>
                        {sbomData.recentComponents.map((c, i) => (
                            <div key={i} className="group grid grid-cols-3 text-xs py-3 border-b border-border/40 last:border-0 items-center hover:bg-muted/30 px-2 -mx-2 transition-colors rounded-md">
                                <span className="font-mono font-semibold text-foreground truncate pl-1">{c.name}</span>
                                <span className="font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md w-fit group-hover:bg-background transition-colors">{c.version}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-[10px] font-medium hidden sm:block truncate">{c.license}</span>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "text-[9px] uppercase tracking-wider px-1.5 py-0 h-4.5 font-bold shadow-sm",
                                            c.risk === "low" ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" : "border-yellow-500/30 text-yellow-600 bg-yellow-500/10"
                                        )}
                                    >
                                        {c.risk}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 flex justify-center">
                        <p className="text-[10px] text-muted-foreground font-medium bg-secondary px-3 py-1 rounded-full w-fit">
                            + {sbomData.totalComponents - sbomData.recentComponents.length} more components in full SBOM manifest
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm">
                        <h3 className="text-sm font-semibold mb-5 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            License Compliance Distribution
                        </h3>
                        <div className="space-y-4">
                            {Object.entries(sbomData.licenses).map(([lic, count]) => (
                                <MiniBar
                                    key={lic}
                                    label={lic === "Apache2" ? "Apache 2.0" : lic}
                                    value={count}
                                    max={sbomData.totalComponents}
                                    color={lic === "GPL" ? "bg-red-500" : lic === "MIT" ? "bg-emerald-500" : lic === "Apache2" ? "bg-blue-500" : lic === "BSD" ? "bg-purple-500" : "bg-muted-foreground"}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-card/50 backdrop-blur-md p-6 shadow-sm">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs border-b border-border/40 pb-3">
                                <span className="text-muted-foreground font-medium">Export Standard</span>
                                <span className="font-bold text-foreground">CycloneDX 1.6 / SPDX 2.3</span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-b border-border/40 pb-3">
                                <span className="text-muted-foreground font-medium">GPL Restricted Packages</span>
                                <Badge variant="outline" className="text-[10px] font-bold border-orange-500/30 text-orange-500 bg-orange-500/10">
                                    8 — Policy Review Needed
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs pb-1">
                                <span className="text-muted-foreground font-medium">Manifest Export Status</span>
                                <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                                    <Lock className="h-3 w-3 text-emerald-600" />
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                        Available
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                disabled
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-background text-xs font-semibold opacity-50 cursor-not-allowed hover:bg-secondary transition-colors"
                            >
                                <FileCode2 className="h-4 w-4" />
                                Export CycloneDX
                            </button>
                            <button
                                disabled
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-background text-xs font-semibold opacity-50 cursor-not-allowed hover:bg-secondary transition-colors"
                            >
                                <FileText className="h-4 w-4" />
                                Export SPDX
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
