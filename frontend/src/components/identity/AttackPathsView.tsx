import IdentityGraphViz from "./IdentityGraphViz";
import { Network } from "lucide-react";

const AttackPathsView = () => {
    return (
        <div className="space-y-6">
            <div className="border border-border/50 rounded-xl bg-card/40 backdrop-blur-md shadow-2xl overflow-hidden h-[750px] flex flex-col">
                <div className="px-6 py-4 border-b border-border/10 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner">
                            <Network className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest">Interactive Identity Attack Path Graph</h3>
                            <p className="text-[9px] font-bold text-muted-foreground/60 mt-0.5 uppercase tracking-tighter">Detecting privilege escalation chains across all cloud & SaaS providers</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase">Engine Online</span>
                    </div>
                </div>
                <div className="flex-1 w-full bg-black/5 relative">
                    <IdentityGraphViz />
                </div>
            </div>
        </div>
    );
};

export default AttackPathsView;
