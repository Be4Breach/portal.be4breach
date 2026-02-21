import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useAuth } from "@/contexts/AuthContext";

export default function RiskTrendChart() {
    const { token } = useAuth();
    const [days, setDays] = useState(30);

    const { data } = useQuery({
        queryKey: ["risk-trend", days],
        queryFn: async () => {
            const resp = await fetch(`/api/identity-risk-intelligence/risk-trend?days=${days}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Failed to fetch trend");
            return resp.json();
        },
        enabled: !!token,
    });

    const trendData = data?.trend ?? [];

    return (
        <Card className="border border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold">Identity Risk Trend</CardTitle>
                <select
                    className="h-7 w-[100px] rounded-md border border-input bg-transparent px-2 text-xs"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                >
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>180 days</option>
                </select>
            </CardHeader>
            <CardContent className="h-[260px] pb-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <defs>
                            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-threat-critical)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--color-threat-critical)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="mfaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-threat-safe)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--color-threat-safe)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(v: string) => v.slice(5)}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            domain={[0, 100]}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 8,
                                fontSize: 12,
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="score"
                            name="Risk Score"
                            stroke="var(--color-threat-critical)"
                            fill="url(#riskGrad)"
                            strokeWidth={2}
                            dot={false}
                            animationDuration={1500}
                        />
                        <Area
                            type="monotone"
                            dataKey="mfaCoverage"
                            name="MFA Coverage"
                            stroke="var(--color-threat-safe)"
                            fill="url(#mfaGrad)"
                            strokeWidth={2}
                            dot={false}
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
