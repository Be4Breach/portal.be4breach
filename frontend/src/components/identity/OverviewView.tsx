import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

import OverviewCards from "./OverviewCards";
import RiskTrendChart from "./RiskTrendChart";
import CopilotChat from "./CopilotChat";
import IdentityGraphViz from "./IdentityGraphViz";
import DashboardCharts from "./DashboardCharts";
import type { Identity, SummaryData } from "../../types/identity";

interface OverviewViewProps {
    summary: SummaryData;
    identities: Identity[];
    onCardClick: (card: string) => void;
    onSelectIdentity: (identity: Identity) => void;
}

const OverviewView = ({ summary, identities, onCardClick, onSelectIdentity }: OverviewViewProps) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            <OverviewCards summary={summary} onCardClick={onCardClick} />

            {/* Dashboard Aggregation Charts (Bar, Pie, Line, Donut, Table) */}
            <DashboardCharts />

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <RiskTrendChart />
                </div>
                <CopilotChat />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 h-full">
                    <IdentityGraphViz />
                </div>
                <div className="border border-border/50 rounded-xl p-6 bg-card/60 backdrop-blur-xl shadow-lg flex flex-col h-full overflow-hidden">
                    <div className="flex items-center gap-2 mb-6 border-b border-border/5 pb-4">
                        <Activity className="h-4 w-4 text-red-500" />
                        <div>
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Critical Assets</h3>
                            <p className="text-[9px] font-bold text-red-500/80 uppercase">Real-time risk escalation</p>
                        </div>
                    </div>
                    <div className="space-y-3 overflow-y-auto pr-1 flex-1 custom-scrollbar min-h-[250px] max-h-[350px]">
                        {identities
                            .filter((i) => i.riskScore >= 60)
                            .slice(0, 10)
                            .map((i) => (
                                <div
                                    key={i.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/10 hover:bg-muted/30 transition-all group cursor-pointer"
                                    onClick={() => onSelectIdentity(i)}
                                >
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black truncate">{i.email}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                            {i.source} · {i.privilegeTier}
                                        </p>
                                    </div>
                                    <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center font-black text-[10px] shadow-inner border border-border/10",
                                        i.riskScore >= 80 ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"
                                    )}>
                                        {Math.round(i.riskScore)}
                                    </div>
                                </div>
                            ))}
                        {identities.filter((i) => i.riskScore >= 60).length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-40">
                                <Activity className="h-10 w-10 text-muted-foreground/20" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-center">No critical alerts</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default OverviewView;
