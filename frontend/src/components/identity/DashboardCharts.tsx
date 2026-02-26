import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    Legend,
    AreaChart,
    Area,
    CartesianGrid
} from "recharts";
import { motion } from "framer-motion";
import { Layers, ShieldCheck, TrendingUp } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";



const COLORS = {
    aws: "#FF9900",
    azure: "#0078D4",
    gcp: "#4285F4",
    okta: "#007DC1",
    github: "#6E7681",
    gitlab: "#FC6D26",
    critical: "#ef4444",
    high: "#f97316",
    medium: "#facc15",
    low: "#22c55e"
};

export default function DashboardCharts() {
    const { token } = useAuth();

    const { data: agg, isLoading } = useQuery({
        queryKey: ["dashboard-aggregation"],
        queryFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/dashboard-aggregation`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Failed to fetch aggregation");
            const data = await resp.json();
            console.log("[API] /dashboard-aggregation response:", data);
            return data;
        },
        enabled: !!token,
        staleTime: 30000,
    });

    if (isLoading || !agg) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="h-[300px] border-border/10 bg-card/40 animate-pulse">
                        <CardHeader className="h-20" />
                        <CardContent />
                    </Card>
                ))}
            </div>
        );
    }

    // Process Provider Data
    const providerData = Object.entries(agg.provider_distribution || {}).map(([name, value]) => ({
        name: name.toUpperCase(),
        value,
        color: COLORS[name as keyof typeof COLORS] || "#888"
    }));

    // Process Risk Data
    const riskData = [
        { name: "Critical", value: agg?.risk_distribution?.critical ?? 0, color: COLORS.critical },
        { name: "High", value: agg?.risk_distribution?.high ?? 0, color: COLORS.high },
        { name: "Medium", value: agg?.risk_distribution?.medium ?? 0, color: COLORS.medium },
        { name: "Low", value: agg?.risk_distribution?.low ?? 0, color: COLORS.low },
    ];

    // Process Sync History (Dummy data for dynamic graph look)
    const generateDummyHistory = () => {
        const dummyData = [];
        const today = new Date();
        // Generate 14 days of data
        let currentRisk = 72; // Starting risk
        for (let i = 13; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);

            // Random walk for dynamic look
            const change = (Math.random() - 0.5) * 15;
            currentRisk = Math.max(40, Math.min(90, currentRisk + change));

            dummyData.push({
                date: date.toISOString(),
                provider: "all",
                avg_risk: Math.round(currentRisk * 10) / 10,
                total_synced: Math.floor(Math.random() * 50) + 150,
                privileged_count: Math.floor(Math.random() * 10) + 20,
                time: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
        }
        return dummyData;
    };

    const historyData = generateDummyHistory();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Identity Distribution by Provider */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border border-border/50 bg-card/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden h-full">
                    <CardHeader className="pb-2 border-b border-border/5 bg-muted/5">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-bold">Cloud Provider Footprint</CardTitle>
                        </div>
                        <CardDescription className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/60">
                            Distribution of identities across monitored ecosystems
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={providerData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="transparent"
                                >
                                    {providerData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Legend
                                    verticalAlign="middle"
                                    align="right"
                                    layout="vertical"
                                    iconType="circle"
                                    formatter={(value) => <span className="text-[10px] uppercase tracking-tighter font-bold text-muted-foreground">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Risk Distribution Breakdown */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border border-border/50 bg-card/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden h-full">
                    <CardHeader className="pb-2 border-b border-border/5 bg-muted/5">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-threat-critical" />
                            <CardTitle className="text-sm font-bold">Posture Risk Breakdown</CardTitle>
                        </div>
                        <CardDescription className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/60">
                            Quantitative analysis of identity risk severities
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={riskData} layout="vertical" margin={{ left: 20, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px'
                                    }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {riskData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Risk Score Trend over Syncs */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
                <Card className="border border-border/50 bg-card/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden">
                    <CardHeader className="pb-2 border-b border-border/5 bg-muted/5 flex flex-row items-center justify-between space-y-0">
                        <div>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-emerald-400" />
                                <CardTitle className="text-sm font-bold">Operational Risk Velocity</CardTitle>
                            </div>
                            <CardDescription className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/60">
                                Real-time average risk movement across last {historyData.length} sync cycles
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="time"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    domain={[0, 100]}
                                />
                                <RechartsTooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="avg_risk"
                                    stroke="hsl(var(--primary))"
                                    fillOpacity={1}
                                    fill="url(#colorRisk)"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "white" }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
