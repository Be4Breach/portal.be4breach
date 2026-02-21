import { useState, useEffect } from "react";
import { ShieldAlert, Target, Users, Fingerprint, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

interface OverviewCardsProps {
    summary: Record<string, any> | undefined;
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
    const totalIdentities = summary?.total_identities ?? 0;
    const riskScore = summary?.global_risk_score?.score ?? 0;
    const breachProbability = summary?.breach_probability?.probability ?? 0;
    const attackPaths = summary?.breach_probability?.totalPaths ?? 0;
    const privilegedRatio = summary?.privileged_ratio ?? 0;
    const adminAccounts = summary?.admin_count ?? 0;
    const mfaCoverage = summary?.mfa_coverage?.coverage ?? 0;
    const noMfaUsers = summary?.mfa_failures ?? 0;

    const hasLiveData = totalIdentities > 0 || riskScore > 0 || breachProbability > 0;

    const displayData = hasLiveData
        ? {
            riskScore,
            totalIdentities,
            breachProbability,
            attackPaths,
            privilegedRatio,
            adminAccounts,
            mfaCoverage,
            noMfaUsers,
        }
        : {
            riskScore: 72,
            totalIdentities: 50,
            breachProbability: 18,
            attackPaths: 6,
            privilegedRatio: 22,
            adminAccounts: 11,
            mfaCoverage: 78,
            noMfaUsers: 11
        };

    const cards = [
        {
            key: "risk",
            title: "Global Identity Risk Score",
            value: displayData.riskScore,
            suffix: "",
            icon: ShieldAlert,
            color: "text-emerald-700",
            bg: "bg-emerald-50 border-emerald-300",
            trendValue: "+4%",
            trendColor: "text-emerald-600",
            trendIcon: TrendingUp,
            sub: `${displayData.totalIdentities} identities monitored`,
        },
        {
            key: "breach",
            title: "Breach Probability",
            value: displayData.breachProbability,
            suffix: "%",
            icon: Target,
            color: "text-blue-700",
            bg: "bg-blue-50 border-blue-300",
            trendValue: "-2%",
            trendColor: "text-blue-600",
            trendIcon: TrendingDown,
            sub: `${displayData.attackPaths} attack paths detected`,
        },
        {
            key: "privilege",
            title: "Privileged Identity Ratio",
            value: displayData.privilegedRatio,
            suffix: "%",
            icon: Users,
            color: "text-purple-700",
            bg: "bg-purple-50 border-purple-300",
            trendValue: "+1%",
            trendColor: "text-purple-600",
            trendIcon: TrendingUp,
            sub: `${displayData.adminAccounts} admin accounts`,
        },
        {
            key: "mfa",
            title: "MFA Enforcement Coverage",
            value: displayData.mfaCoverage,
            suffix: "%",
            icon: Fingerprint,
            color: "text-orange-700",
            bg: "bg-orange-50 border-orange-300",
            trendValue: "+3%",
            trendColor: "text-orange-600",
            trendIcon: TrendingUp,
            sub: `${displayData.noMfaUsers} identities without MFA`,
        },
    ];

    return (
        <div className="grid grid-cols-4 gap-6 w-full lg:grid-cols-4 md:grid-cols-2 sm:grid-cols-1">
            {cards.map((c, idx) => (
                <motion.div
                    key={c.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.4 }}
                    className="w-full flex"
                >
                    <Card
                        className={`relative overflow-hidden cursor-pointer border ${c.bg} shadow-md transition-all duration-200 hover:shadow-lg min-h-[180px] w-full p-6 rounded-2xl flex flex-col justify-between`}
                        onClick={() => onCardClick(c.key)}
                    >
                        <div className="flex flex-col justify-between h-full space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/80">{c.title}</p>
                                    <c.icon className={`h-5 w-5 ${c.color}`} />
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-4xl font-black mt-2 ${c.color}`}>
                                        <AnimatedCounter value={Math.round(c.value)} suffix={c.suffix} />
                                    </span>
                                    <div className={`flex items-center gap-1 text-[10px] font-bold ${c.trendColor} ml-2 bg-white/50 px-1.5 py-0.5 rounded border border-current/10`}>
                                        <c.trendIcon className="h-3 w-3" />
                                        {c.trendValue}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs font-semibold text-muted-foreground/70">{c.sub}</p>
                        </div>
                    </Card>
                </motion.div>
            ))}
        </div>
    );
}


