import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cloud, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectorCardProps {
    title: string;
    status: 'connected' | 'error' | 'disconnected';
    projectId?: string;
    users?: number;
    serviceAccounts?: number;
    privilegedAccounts?: number;
    lastSync?: string;
    onSync?: () => void;
    isLoading?: boolean;
}

export const ConnectorCard = ({
    title, status, projectId, users, serviceAccounts, privilegedAccounts, lastSync, onSync, isLoading
}: ConnectorCardProps) => {
    return (
        <Card className="relative overflow-hidden group p-5 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/40 transition-all duration-300 shadow-lg hover:shadow-primary/5">
            {/* Ambient Background Gradient */}
            <div className={cn(
                "absolute -right-8 -top-8 w-24 h-24 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20",
                status === 'connected' ? "bg-emerald-500" : status === 'error' ? "bg-destructive" : "bg-primary"
            )} />

            {/* Status indicator bar */}
            <div className={cn(
                "absolute top-0 left-0 w-full h-1 transition-colors duration-300",
                status === 'connected' ? "bg-emerald-500" : status === 'error' ? "bg-destructive" : "bg-muted"
            )} />

            <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2.5 rounded-xl bg-secondary/80 border border-border/50 group-hover:scale-105 transition-transform duration-300",
                        status === 'connected' ? "text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
                            status === 'error' ? "text-destructive" : "text-muted-foreground"
                    )}>
                        <Cloud className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5 opacity-80">
                            {projectId || "Not Configured"}
                        </p>
                    </div>
                </div>
                <Badge variant="outline" className={cn(
                    "text-[9px] py-0 px-2 h-5 font-black shrink-0 tracking-tighter",
                    status === 'connected' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]" :
                        status === 'error' ? "bg-destructive/10 text-destructive border-destructive/20" :
                            "bg-muted/50 text-muted-foreground border-transparent"
                )}>
                    {status === 'connected' ? "CONNECT" : status === 'error' ? "ERROR" : "OFF"}
                </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-5">
                <div className="text-center p-2.5 rounded-xl bg-secondary/30 border border-border/5 group-hover:bg-secondary/50 transition-colors">
                    <p className="text-xl font-black leading-none tracking-tight">{users ?? 0}</p>
                    <p className="text-[8px] text-muted-foreground uppercase font-bold mt-1.5 opacity-70">Users</p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-secondary/30 border border-border/5 group-hover:bg-secondary/50 transition-colors">
                    <p className="text-xl font-black leading-none tracking-tight">{serviceAccounts ?? 0}</p>
                    <p className="text-[8px] text-muted-foreground uppercase font-bold mt-1.5 opacity-70">S.A.</p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-secondary/30 border border-border/5 group-hover:bg-secondary/50 transition-colors">
                    <p className={cn("text-xl font-black leading-none tracking-tight", (privilegedAccounts ?? 0) > 0 ? "text-threat-critical" : "")}>
                        {privilegedAccounts ?? 0}
                    </p>
                    <p className="text-[8px] text-muted-foreground uppercase font-bold mt-1.5 opacity-70">Privs</p>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/10">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                    <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin text-primary")} />
                    <span className="truncate">Last: {lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Never"}</span>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onSync?.(); }}
                    disabled={status === 'disconnected' || isLoading}
                    className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 disabled:opacity-30 disabled:transition-none transition-all active:scale-95"
                >
                    Sync now
                </button>
            </div>
        </Card>
    );
};
