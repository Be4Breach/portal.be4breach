import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, Clock, Server, AlertTriangle } from "lucide-react";

type Alert = {
  id: number;
  name: string;
  source: string;
  severity: string;
  time: string;
  description: string;
};

const severityStyles: Record<string, string> = {
  Critical: "bg-destructive text-destructive-foreground",
  High: "bg-threat-high text-white",
  Medium: "bg-threat-medium text-white",
  Low: "bg-threat-low text-white",
};

const RecentAlerts = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Alert | null>(null);
  const { data, loading } = useDashboardData();

  if (loading || !data) {
    return (
      <Card className="p-5 animate-fade-in animate-fade-in-delay-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Recent Threat Alerts</h3>
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-muted rounded w-full mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
                <div className="h-5 w-12 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-5 animate-fade-in animate-fade-in-delay-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Recent Threat Alerts</h3>
          <button
            onClick={() => navigate("/alerts")}
            className="text-xs text-destructive hover:underline font-medium"
          >
            View All
          </button>
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {data.recentAlerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => setSelected(alert)}
              className={cn(
                "w-full text-left p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow cursor-pointer",
                alert.severity === "Critical" && "border-l-2 border-l-destructive"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{alert.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <span>{alert.source}</span>
                    <span>•</span>
                    <span>{alert.time}</span>
                  </div>
                </div>
                <Badge className={cn("text-[10px] shrink-0", severityStyles[alert.severity])}>
                  {alert.severity}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={cn("h-5 w-5", selected?.severity === "Critical" ? "text-destructive" : "text-threat-high")} />
              {selected?.name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={cn("text-xs", severityStyles[selected.severity])}>
                  {selected.severity}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">{selected.description}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Source</p>
                    <p className="text-sm font-medium">{selected.source}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Detected</p>
                    <p className="text-sm font-medium">{selected.time}</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-destructive" />
                  <p className="text-xs font-semibold">Recommended Actions</p>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>Isolate affected systems immediately</li>
                  <li>Review logs for lateral movement indicators</li>
                  <li>Update threat signatures across all endpoints</li>
                  <li>Notify incident response team</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setSelected(null); navigate("/alerts"); }}
                  className="flex-1 h-9 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Investigate
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="flex-1 h-9 rounded-md border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RecentAlerts;
