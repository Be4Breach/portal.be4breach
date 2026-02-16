import { Shield, AlertTriangle, Monitor, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/useDashboardData";



const StatsCards = () => {
  const { data, loading } = useDashboardData();

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <div className="h-3 bg-muted rounded w-20"></div>
              <div className="h-8 bg-muted rounded w-16"></div>
              <div className="h-3 bg-muted rounded w-12"></div>
            </div>
            <div className="p-2 rounded-lg bg-secondary">
              <div className="h-5 w-5 bg-muted rounded"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Total Threats Detected",
      value: data.statsData.totalThreats.value.toLocaleString(),
      change: data.statsData.totalThreats.change,
      trend: data.statsData.totalThreats.trend,
      icon: Shield,
    },
    {
      label: "Critical Alerts",
      value: data.statsData.criticalAlerts.value,
      change: data.statsData.criticalAlerts.change,
      trend: data.statsData.criticalAlerts.trend,
      icon: AlertTriangle,
      critical: true,
    },
    {
      label: "Systems Monitored",
      value: data.statsData.systemsMonitored.value.toLocaleString(),
      change: data.statsData.systemsMonitored.change,
      trend: data.statsData.systemsMonitored.trend,
      icon: Monitor,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.critical ? "text-destructive" : "text-foreground"}`}>
              {stat.value}
            </p>
            <div className="flex items-center gap-1 text-xs">
              {stat.trend === "up" ? (
                <TrendingUp className="h-3 w-3 text-threat-safe" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <span className={stat.trend === "down" && stat.critical ? "text-threat-safe" : "text-muted-foreground"}>
                {Math.abs(stat.change)}%
              </span>
            </div>
          </div>
          <div className={`p-2 rounded-lg ${stat.critical ? "bg-destructive/10" : "bg-secondary"}`}>
            <stat.icon className={`h-5 w-5 ${stat.critical ? "text-destructive" : "text-muted-foreground"}`} />
          </div>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
