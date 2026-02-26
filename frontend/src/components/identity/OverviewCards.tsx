import { useState, useEffect } from "react";
import { ShieldAlert, Target, Users, Fingerprint, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import type { SummaryData } from "../../types/identity";

interface OverviewCardsProps {
    summary: SummaryData | undefined;
    onCardClick: (card: string) => void;
}

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        let requestId: number;
        const duration = 1200;
        const start = performance.now();
        const from = 0;
        const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(from + (value - from) * eased));
            if (progress < 1) {
                requestId = requestAnimationFrame(animate);
            }
        };
        requestId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestId);
    }, [value]);
    return <>{display}{suffix}</>;
}



export default function OverviewCards({ summary, onCardClick }: OverviewCardsProps) {
    if (!summary) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-[180px] w-full rounded-2xl bg-card border border-border/10 animate-pulse relative overflow-hidden shadow-sm">
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="h-2 w-24 bg-muted/20 rounded" />
                                <div className="h-5 w-5 bg-muted/20 rounded-full" />
                            </div>
                            <div className="h-10 w-32 bg-muted/20 rounded" />
                            <div className="h-3 w-48 bg-muted/20 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const riskScore = summary?.global_risk_score?.score ?? 0;
    const breachProbability = summary?.breach_probability?.probability ?? 0;
    const attackPaths = summary?.breach_probability?.totalPaths ?? 0;
    const privilegedRatio = summary?.privileged_ratio ?? 0;
    const adminAccounts = summary?.admin_count ?? 0;
    const mfaCoverage = summary?.mfa_coverage?.coverage ?? 0;
    const mfaFailures = summary?.mfa_failures ?? 0;

    const cards = [
        {
            key: "risk",
            title: "Global Identity Score",
            value: riskScore,
            suffix: "",
            icon: ShieldAlert,
            color: "text-emerald-500",
            bg: "hover:border-emerald-500/30",
            trendValue: "+0%",
            trendColor: "text-emerald-500",
            trendIcon: TrendingUp,
            sub: `${summary?.total_identities ?? 0} identities monitored`,
        },
        {
            key: "breach",
            title: "Breach Probability",
            value: breachProbability,
            suffix: "%",
            icon: Target,
            color: "text-blue-500",
            bg: "hover:border-blue-500/30",
            trendValue: "0%",
            trendColor: "text-blue-500",
            trendIcon: TrendingDown,
            sub: `${attackPaths} attack paths detected`,
        },
        {
            key: "privilege",
            title: "Privileged Identity Ratio",
            value: privilegedRatio,
            suffix: "%",
            icon: Users,
            color: "text-purple-500",
            bg: "hover:border-purple-500/30",
            trendValue: "0%",
            trendColor: "text-purple-400",
            trendIcon: TrendingUp,
            sub: `${adminAccounts} admin accounts`,
        },
        {
            key: "mfa",
            title: "MFA Enforcement Coverage",
            value: mfaCoverage,
            suffix: "%",
            icon: Fingerprint,
            color: "text-orange-500",
            bg: "hover:border-orange-500/30",
            trendValue: "0%",
            trendColor: "text-orange-400",
            trendIcon: TrendingUp,
            sub: `${mfaFailures} identities without MFA`,
        },
    ];

    const getRiskColor = (key: string, value: number) => {
        if (key === "risk") {
            if (value >= 80) return "text-red-500";
            if (value >= 50) return "text-orange-500";
            if (value >= 30) return "text-amber-500";
            return "text-emerald-500";
        }
        if (key === "breach") {
            if (value >= 50) return "text-red-500";
            if (value >= 25) return "text-orange-500";
            return "text-blue-500";
        }
        if (key === "privilege") return "text-purple-500";
        if (key === "mfa") {
            if (value <= 50) return "text-red-500";
            if (value <= 80) return "text-orange-500";
            return "text-emerald-500";
        }
        return "text-primary";
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {cards.map((c, idx) => {
                const dynamicColor = getRiskColor(c.key, c.value);
                return (
                    <motion.div
                        key={c.key}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1, duration: 0.5, ease: "easeOut" }}
                    >
                        <Card
                            className={cn(
                                "group relative overflow-hidden cursor-pointer border border-border/10 bg-card/60 backdrop-blur-xl shadow-sm transition-all duration-300",
                                "hover:shadow-xl hover:-translate-y-1 min-h-[180px] w-full p-6 rounded-2xl flex flex-col justify-between",
                                c.bg
                            )}
                            onClick={() => onCardClick(c.key)}
                        >
                            {/* Background subtle glow */}
                            <div className={cn("absolute -top-12 -right-12 h-24 w-24 rounded-full blur-[60px] opacity-20 transition-opacity group-hover:opacity-40", dynamicColor.replace("text-", "bg-"))} />

                            <div className="flex flex-col justify-between h-full space-y-4 relative z-10">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60">{c.title}</p>
                                        <div className={cn("p-2 rounded-xl bg-muted/5 group-hover:scale-110 transition-transform duration-300", dynamicColor)}>
                                            <c.icon className="h-5 w-5" />
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className={cn("text-4xl font-extrabold tracking-tight mt-1", dynamicColor)}>
                                            <AnimatedCounter value={Math.round(c.value)} suffix={c.suffix} />
                                        </span>
                                        {c.trendValue !== "0%" && (
                                            <div className={cn("flex items-center gap-1 text-[10px] font-bold py-0.5 px-2 rounded-full border border-current/10 bg-current/5", dynamicColor)}>
                                                <c.trendIcon className="h-3 w-3" />
                                                {c.trendValue}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs font-medium text-muted-foreground/50 border-t border-border/5 pt-4">{c.sub}</p>
                            </div>
                        </Card>
                    </motion.div>
                );
            })}
        </div>
    );
}

