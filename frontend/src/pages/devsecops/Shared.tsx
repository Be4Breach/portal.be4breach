import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

export function timeAgo(dateStr: string): string {
    // Normalise: if string has no timezone info (no Z, no +, no -TZ), treat as UTC
    const normalised = /Z|[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : dateStr + "Z";
    const diff = Date.now() - new Date(normalised).getTime();
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

export function scoreColor(score: number) {
    if (score >= 80) return { text: "text-emerald-500", bg: "bg-emerald-500", ring: "stroke-emerald-500", label: "Good" };
    if (score >= 60) return { text: "text-yellow-500", bg: "bg-yellow-500", ring: "stroke-yellow-500", label: "Fair" };
    if (score >= 40) return { text: "text-orange-500", bg: "bg-orange-500", ring: "stroke-orange-500", label: "Poor" };
    return { text: "text-red-500", bg: "bg-red-500", ring: "stroke-red-500", label: "Critical" };
}

export function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
    const r = 30;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const color = scoreColor(score);
    return (
        <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
            <svg className="-rotate-90" width={size} height={size} viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
                <circle
                    cx="40" cy="40" r={r} fill="none"
                    stroke="currentColor" strokeWidth="6"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={`transition-all duration-700 ${color.ring}`}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-lg font-bold leading-none ${color.text}`}>{score}</span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-wide">{color.label}</span>
            </div>
        </div>
    );
}

export function StatCard({
    title, value, sub, icon: Icon, iconCls, trend, trendUp
}: {
    title: string; value: string | number; sub?: string;
    icon: React.ElementType; iconCls: string; trend?: string; trendUp?: boolean;
}) {
    return (
        <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-5 space-y-3 hover:shadow-md hover:border-primary/20 transition-all group">
            <div className="flex items-start justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", iconCls)}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div>
                <p className="text-2xl font-bold bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
            </div>
            {trend && (
                <div className={cn("flex items-center gap-1 text-xs font-medium", trendUp ? "text-emerald-500" : "text-red-500")}>
                    {trendUp ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {trend}
                </div>
            )}
        </div>
    );
}

export function SectionHeader({
    icon: Icon, title, subtitle, badge, color = "text-primary"
}: {
    icon: React.ElementType; title: string; subtitle: string; badge?: string; color?: string;
}) {
    return (
        <div className="flex items-start gap-4 mb-5">
            <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border bg-gradient-to-br", `bg-current/[0.05] border-current/20`, color)}>
                <Icon className={cn("h-6 w-6", color)} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold">{title}</h2>
                    {badge && (
                        <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                            {badge}
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>
            </div>
        </div>
    );
}

export const SEV_MAP: Record<string, { label: string; cls: string }> = {
    CRITICAL: { label: "Critical", cls: "bg-red-500/10 text-red-500 border-red-500/30" },
    ERROR: { label: "High", cls: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
    HIGH: { label: "High", cls: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
    MEDIUM: { label: "Medium", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
    WARNING: { label: "Medium", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
    LOW: { label: "Low", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
    INFO: { label: "Info", cls: "bg-blue-500/10 text-blue-400 border-blue-400/30" },
};

export function VulnRow({ sev, name, detail, file }: { sev: string; name: string; detail: string; file?: string }) {
    const s = SEV_MAP[sev] ?? SEV_MAP.INFO;
    return (
        <div className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0 hover:bg-muted/30 px-2 -mx-2 rounded-md transition-colors">
            <Badge variant="outline" className={cn("text-[10px] w-16 justify-center px-1.5 py-0 h-5 shrink-0 font-bold", s.cls)}>{s.label}</Badge>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate text-foreground/90">{name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{detail}</p>
            </div>
            {file && <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">.../{file.split("/").pop()}</span>}
        </div>
    );
}

export function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="space-y-1.5 group">
            <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                <span className="font-semibold tabular-nums">{value}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-1000 ease-out", color)}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
