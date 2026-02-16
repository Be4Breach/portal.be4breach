import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const ThreatTrends = () => {
  const { data, loading, error } = useDashboardData();

  if (loading || !data) {
    return (
      <Card className="p-5 animate-fade-in animate-fade-in-delay-1">
        <h3 className="text-sm font-semibold mb-4">Top Threat Trends</h3>
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-5 animate-fade-in animate-fade-in-delay-1">
      <h3 className="text-sm font-semibold mb-1">Top Threat Trends</h3>
      {error && <p className="text-xs text-destructive mb-2">Failed to load latest data: {error}</p>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.threatTrendsData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0,72%,51%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(0,72%,51%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(25,95%,53%)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(25,95%,53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(0,0%,64%)" tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(0,0%,64%)" tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(0,0%,100%)",
                border: "1px solid hsl(0,0%,90%)",
                borderRadius: "0.5rem",
                fontSize: 12,
              }}
            />
            <Area type="monotone" dataKey="critical" stroke="hsl(0,72%,51%)" fill="url(#critGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="high" stroke="hsl(25,95%,53%)" fill="url(#highGrad)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="medium" stroke="hsl(45,93%,47%)" fill="transparent" strokeWidth={1.5} />
            <Area type="monotone" dataKey="low" stroke="hsl(0,0%,64%)" fill="transparent" strokeWidth={1} strokeDasharray="4 4" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-3 text-[10px] font-medium text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" />Critical</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-threat-high" />High</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-threat-medium" />Medium</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-threat-low" />Low</span>
      </div>
    </Card>
  );
};

export default ThreatTrends;
