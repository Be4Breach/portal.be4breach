import IdentityGraphViz from "./IdentityGraphViz";

const AttackPathsView = () => {
    return (
        <div className="space-y-6">
            <div className="border border-border/50 rounded-xl bg-card overflow-hidden h-[700px]">
                <div className="px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold">Interactive Identity Attack Path Graph</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Detecting privilege escalation chains across all cloud &amp; SaaS providers</p>
                    </div>
                </div>
                <div className="h-full w-full">
                    <IdentityGraphViz />
                </div>
            </div>
        </div>
    );
};

export default AttackPathsView;
