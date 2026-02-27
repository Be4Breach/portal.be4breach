import { useNavigate } from "react-router-dom";
import { Shield, Package, Code2, Globe, Layers, Radar, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScoreRing, scoreColor } from "./devsecops/Shared";

import OverviewDashboard from "./devsecops/OverviewDashboard";
import RepositoriesPage from "./RepositoriesPage";
import SCADashboard from "./devsecops/SCADashboard";
import SASTDashboard from "./devsecops/SASTDashboard";
import DASTDashboard from "./devsecops/DASTDashboard";
import SBOMDashboard from "./devsecops/SBOMDashboard";
import GitleaksDashboard from "./devsecops/GitleaksDashboard";

type TabId = "overview" | "repositories" | "sca" | "sast" | "dast" | "sbom" | "gitleaks";

export default function DevSecOpsDashboard({ defaultTab = "overview" }: { defaultTab?: TabId }) {
    const navigate = useNavigate();

    const activeTab = defaultTab;
    const overallScore = 62;

    const tabs = [
        { id: "overview", label: "Projects", icon: Radar },
        { id: "repositories", label: "Repositories", icon: Code2 },
        { id: "sca", label: "SCA", icon: Package },
        { id: "sast", label: "SAST", icon: Code2 },
        { id: "dast", label: "DAST", icon: Globe },
        { id: "sbom", label: "SBOM", icon: Layers },
        { id: "gitleaks", label: "Secrets", icon: KeyRound },
    ] as const;

    return (
        <div className="space-y-8 pb-10 max-w-[1600px] mx-auto">
            {/* ── Hero Header ────────────────────────────────────────────────── */}
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm relative">
                {/* Background decorative gradients */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-card to-destructive/5 pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-destructive/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

                <div className="relative px-8 py-8 flex flex-col md:flex-row md:items-center gap-6 z-10">
                    <div className="flex items-center gap-6 flex-1">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-inner flex items-center justify-center shrink-0 backdrop-blur-sm">
                            <Shield className="h-8 w-8 text-primary drop-shadow-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                                DevSecOps Hub
                                <Badge variant="outline" className="text-xs px-2.5 py-0.5 h-6 border-primary/30 text-primary bg-primary/10 shadow-sm uppercase tracking-widest font-bold">
                                    LIVE
                                </Badge>
                            </h1>
                            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed font-medium">
                                Unified Enterprise Security Posture Management. Continuous scanning across your supply chain, codebase, and runtime environments.
                            </p>
                        </div>
                    </div>

                    {/* Overall score */}
                    <div className="flex items-center gap-5 shrink-0 bg-background/40 backdrop-blur-md p-4 rounded-2xl border shadow-sm">
                        <div className="text-right hidden sm:block space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Risk Management</p>
                            <p className="text-sm font-semibold">{scoreColor(overallScore).label} Posture</p>
                        </div>
                        <ScoreRing score={overallScore} size={84} />
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex border-t overflow-x-auto relative z-10 bg-card/50 backdrop-blur-sm scrollbar-hide">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                id={`devsecops-tab-${tab.id}`}
                                onClick={() => navigate(tab.id === "overview" ? "/devsecops" : `/devsecops/${tab.id}`)}
                                className={cn(
                                    "relative flex items-center gap-2.5 px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap overflow-hidden group",
                                    isActive
                                        ? "text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                                )}
                            >
                                {isActive && (
                                    <span className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-full shadow-[0_-2px_8px_hsl(var(--primary)/0.5)]" />
                                )}
                                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110 duration-300", isActive && "text-primary")} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area with smooth fade-in */}
            <div className="relative mt-8">
                {activeTab === "overview" && <OverviewDashboard />}
                {activeTab === "repositories" && (
                    <div className="rounded-2xl border bg-card/60 backdrop-blur-sm p-6 shadow-sm animate-in slide-in-from-bottom-4 duration-500 fade-in">
                        <RepositoriesPage />
                    </div>
                )}
                {activeTab === "sca" && <SCADashboard />}
                {activeTab === "sast" && <SASTDashboard />}
                {activeTab === "dast" && <DASTDashboard />}
                {activeTab === "sbom" && <SBOMDashboard />}
                {activeTab === "gitleaks" && <GitleaksDashboard />}
            </div>
        </div>
    );
}
