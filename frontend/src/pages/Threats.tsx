import StatsCards from "@/components/dashboard/StatsCards";
import ThreatTrends from "@/components/dashboard/ThreatTrends";
import SeverityBreakdown from "@/components/dashboard/SeverityBreakdown";
import AttackVectors from "@/components/dashboard/AttackVectors";
import ThreatMap from "@/components/dashboard/ThreatMap";
import RecentAlerts from "@/components/dashboard/RecentAlerts";
import RiskGauge from "@/components/dashboard/RiskGauge";

const Threats = () => {
  return (
    <div className="space-y-3 w-full max-w-6xl">
      <div>
        <h1 className="text-xl font-bold">Threat Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          Live detection, trending intelligence, and geo activity across the estate.
        </p>
      </div>

      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ThreatTrends />
        </div>
        <SeverityBreakdown />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttackVectors />
        <RiskGauge />
      </div>

      <ThreatMap />

      <RecentAlerts />
    </div>
  );
};

export default Threats;
