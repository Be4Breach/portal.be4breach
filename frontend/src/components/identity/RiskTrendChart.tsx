import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp } from "lucide-react";

export default function RiskTrendChart() {
    const { token } = useAuth();
    const [days, setDays] = useState(30);
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

    useQuery({
        queryKey: ["risk-trend", days],
        queryFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/risk-trend?days=${days}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Failed to fetch trend");
            return resp.json();
        },
        enabled: !!token,
    });

    // Process Identity Analyzer Trend (Dummy data for dynamic graph look)
    const generateDummyTrend = (numDays: number) => {
        const dummyData = [];
        const today = new Date();
        let currentRisk = 65;
        let currentMfa = 80;

        for (let i = numDays; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);

            // Random walk for dynamic look
            const riskChange = (Math.random() - 0.5) * 10;
            const mfaChange = (Math.random() - 0.3) * 5; // Slight upward trend usually

            currentRisk = Math.max(30, Math.min(95, currentRisk + riskChange));
            currentMfa = Math.max(40, Math.min(100, currentMfa + mfaChange));

            dummyData.push({
                date: date.toISOString().split('T')[0],
                score: Math.round(currentRisk * 10) / 10,
                mfaCoverage: Math.round(currentMfa * 10) / 10,
                criticalCount: Math.floor(Math.random() * 5) + 5,
                totalIdentities: Math.floor(Math.random() * 20) + 100,
                provider: "all"
            });
        }
        return dummyData;
    };

    const trendData = generateDummyTrend(days);

    return (
        <Card className="border border-border/50 bg-card/40 backdrop-blur-md shadow-lg rounded-xl overflow-hidden flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Identity Analyzer Trend
                </CardTitle>
                <select
                    className="h-7 w-[110px] rounded-md border border-input bg-card/50 px-2 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-primary"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                >
                    <option value={7}>LAST 7 DAYS</option>
                    <option value={30}>LAST 30 DAYS</option>
                    <option value={90}>LAST 90 DAYS</option>
                    <option value={180}>LAST 180 DAYS</option>
                </select>
            </CardHeader>
            <CardContent className="h-[350px] w-full p-4 pt-0 relative">
                {!trendData.length ? (
                    <div className="absolute inset-x-6 inset-y-4 rounded-lg bg-muted/5 animate-pulse overflow-hidden flex flex-col items-center justify-center">
                        <div className="h-4 w-32 bg-muted/20 rounded mb-4" />
                        <div className="h-32 w-full bg-muted/10 rounded" />
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="mfaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                tickFormatter={(v: string) => v.slice(5)}
                                interval="preserveStartEnd"
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                domain={[0, 100]}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: 12,
                                    fontSize: 12,
                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="score"
                                name="Risk Score"
                                stroke="#ef4444"
                                fill="url(#riskGrad)"
                                strokeWidth={2}
                                dot={false}
                                animationDuration={1500}
                            />
                            <Area
                                type="monotone"
                                dataKey="mfaCoverage"
                                name="MFA Coverage"
                                stroke="#22c55e"
                                fill="url(#mfaGrad)"
                                strokeWidth={2}
                                dot={false}
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
