import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import OverviewCards from "./OverviewCards";
import RiskTrendChart from "./RiskTrendChart";
import CopilotChat from "./CopilotChat";
import IdentityGraphViz from "./IdentityGraphViz";

interface OverviewViewProps {
    summary: any;
    identities: any[];
    onCardClick: (card: string) => void;
    onSelectIdentity: (identity: any) => void;
}

const OverviewView = ({ summary, identities, onCardClick, onSelectIdentity }: OverviewViewProps) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            <OverviewCards summary={summary} onCardClick={onCardClick} />

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <RiskTrendChart />
                </div>
                <CopilotChat />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <IdentityGraphViz />
                <div className="border border-border/50 rounded-lg p-4 bg-card shadow-sm space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity className="h-4 w-4 text-red-400" />
                        <h3 className="text-sm font-semibold">Critical Identity Alerts</h3>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {identities
                            .filter((i) => i.riskScore >= 60)
                            .slice(0, 8)
                            .map((i) => (
                                <div
                                    key={i.id}
                                    className="flex items-center justify-between p-2 rounded-md bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors border border-border/30"
                                    onClick={() => onSelectIdentity(i)}
                                >
                                    <div>
                                        <p className="text-xs font-medium truncate max-w-[150px]">{i.email}</p>
                                        <p className="text-[10px] text-muted-foreground">{i.source.toUpperCase()} · {i.privilegeTier}</p>
                                    </div>
                                    <span className={`text-xs font-bold ${i.riskScore >= 80 ? "text-threat-critical" : "text-threat-high"}`}>
                                        {i.riskScore}
                                    </span>
                                </div>
                            ))}
                        {identities.filter((i) => i.riskScore >= 60).length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-8">No critical alerts detected</p>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default OverviewView;
