import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ClipboardCheck, Settings, ArrowUpRight, Loader2, Sparkles, Activity, Radar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import DashboardCopilot from "@/components/DashboardCopilot";
import { useDashboardData } from "@/hooks/useDashboardData";
import { isoQuestions } from "@/data/isoQuestions";
import { useAuth } from "@/contexts/AuthContext";

type Answer = "yes" | "no" | "skip" | null;
type AnswerRecord = { answer: Answer; evidenceName?: string };
type StoredAnswers = { answers?: Record<string, AnswerRecord>; complete?: boolean };

const STORAGE_KEY = "bb_iso_answers_v1";

const computeComplianceProgress = (answers: Record<string, AnswerRecord>) => {
  const total = isoQuestions.length || 1;
  let answered = 0;
  let failing = 0;
  let missing = 0;
  let passed = 0;

  isoQuestions.forEach((q) => {
    const record = answers[q.id];
    if (record?.answer) {
      answered += 1;
      if (record.answer === "no") {
        failing += 1;
      } else if (record.answer === "yes") {
        const hasEvidence = !q.requiresEvidence || !!record.evidenceName;
        if (hasEvidence) {
          passed += 1;
        } else {
          missing += 1;
        }
      } else {
        missing += 1;
      }
    } else {
      missing += 1;
    }
  });

  const rawScore = ((passed - failing * 0.5) / total) * 100;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  return { answered, total, failing, missing, score };
};

const Index = () => {
  const navigate = useNavigate();
  const { data, loading } = useDashboardData();
  const { user } = useAuth();
  const [complianceProgress, setComplianceProgress] = useState(() =>
    computeComplianceProgress({}),
  );

  const getFirstName = () => {
    if (user?.first_name) return user.first_name;
    if (user?.github_name) return user.github_name.split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "User";
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as StoredAnswers) : undefined;
      const answers = parsed?.answers ?? {};
      setComplianceProgress(computeComplianceProgress(answers));
    } catch (err) {
      console.warn("Failed to hydrate compliance summary", err);
    }
  }, []);

  const recentAlerts = useMemo(() => data?.recentAlerts.slice(0, 3) ?? [], [data]);
  const riskScore = data?.statsData.riskScore ?? 0;
  const ringAngle = Math.min(360, Math.max(0, riskScore * 3.6));

  return (
    <div className="space-y-6 w-full max-w-6xl">
      <h1 className="text-3xl md:text-4xl font-semibold text-zinc-800 tracking-tight pt-2 pb-1">
        {getGreeting()}, {getFirstName()}
      </h1>

      <DashboardCopilot />

      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 shadow-lg">
        <div className="absolute inset-0 opacity-30 mix-blend-screen bg-[radial-gradient(circle_at_20%_20%,#ef4444_0,transparent_35%),radial-gradient(circle_at_80%_10%,#f97316_0,transparent_30%),radial-gradient(circle_at_80%_80%,#22d3ee_0,transparent_35%)]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[12px] font-semibold">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Live Security Overview
            </div>
            <h1 className="text-2xl font-bold tracking-tight">See everything in one glance</h1>
            <p className="text-sm text-slate-200/80 max-w-xl">
              Faster triage for execs and responders: threats, alerts, compliance, analytics, and reports stitched together.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
                Auto-refreshed feed
              </Badge>
              <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
                Drill-down ready
              </Badge>
              <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
                Role-based routing
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative h-28 w-28 shrink-0">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(#ef4444 ${ringAngle}deg, rgba(255,255,255,0.08) ${ringAngle}deg)`,
                }}
              />
              <div className="absolute inset-2 rounded-full bg-slate-900/80 border border-white/10 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{loading ? "--" : riskScore}</span>
                <span className="text-[11px] uppercase tracking-wide text-slate-300/80">Risk</span>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-100">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span>Critical alerts: <strong>{loading ? "..." : data?.statsData.criticalAlerts.value ?? "-"}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                <span>Total threats: <strong>{loading ? "..." : data?.statsData.totalThreats.value.toLocaleString() ?? "-"}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                <span>Systems monitored: <strong>{loading ? "..." : data?.statsData.systemsMonitored.value.toLocaleString() ?? "-"}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-slate-300/80">
                <Activity className="h-4 w-4" />
                Updated in real time from Threat Monitoring
              </div>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100" onClick={() => navigate("/threats")}>
            <Radar className="h-4 w-4 mr-2" />
            Threat console
          </Button>
          <Button size="sm" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100" onClick={() => navigate("/alerts")}>
            Alert queue
          </Button>
          <Button size="sm" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100" onClick={() => navigate("/compliance")}>
            Compliance
          </Button>
          <Button size="sm" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100" onClick={() => navigate("/reports")}>
            Reports
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="p-5 space-y-3 border-t-4 border-destructive/70 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Threats</p>
              <h3 className="text-lg font-semibold">Detection Pulse</h3>
            </div>
            <Badge variant="outline" className="gap-1 text-[11px]">
              <Shield className="h-3 w-3" />
              Live
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center justify-between">
              <span>Total threats</span>
              <strong>{loading ? "..." : data?.statsData.totalThreats.value.toLocaleString() ?? "-"}</strong>
            </p>
            <p className="flex items-center justify-between text-destructive">
              <span>Critical alerts</span>
              <strong>{loading ? "..." : data?.statsData.criticalAlerts.value ?? "-"}</strong>
            </p>
            <p className="flex items-center justify-between">
              <span>Risk score</span>
              <strong>{loading ? "..." : data?.statsData.riskScore ?? "-"}/100</strong>
            </p>
          </div>
          <Button className="w-full justify-between" onClick={() => navigate("/threats")}>
            Go to Threat Monitoring
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Card>

        <Card className="p-5 space-y-3 border-t-4 border-amber-400/80 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Alerts</p>
              <h3 className="text-lg font-semibold">Recent Signals</h3>
            </div>
            <Badge variant="secondary" className="text-[11px]">
              {loading ? "..." : `${recentAlerts.length} new`}
            </Badge>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Pulling latest alerts...
              </div>
            )}
            {!loading && recentAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground">No fresh alerts. All clear.</p>
            )}
            {!loading &&
              recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-2 rounded-lg border bg-card flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{alert.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{alert.description}</p>
                  </div>
                  <Badge
                    className="text-[10px] shrink-0"
                    variant={alert.severity === "Critical" ? "destructive" : "secondary"}
                  >
                    {alert.severity}
                  </Badge>
                </div>
              ))}
          </div>
          <Button variant="outline" className="w-full justify-between" onClick={() => navigate("/alerts")}>
            View Alerts
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Card>

        <Card className="p-5 space-y-3 border-t-4 border-cyan-500/70 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Compliance</p>
              <h3 className="text-lg font-semibold">ISO Readiness</h3>
            </div>
            <Badge variant="outline" className="gap-1 text-[11px]">
              <ClipboardCheck className="h-3 w-3" />
              {complianceProgress.score}%
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Questionnaire</span>
              <span className="font-medium">
                {complianceProgress.answered}/{complianceProgress.total} answered
              </span>
            </div>
            <Progress value={(complianceProgress.answered / complianceProgress.total) * 100} />
            <p className="text-xs text-muted-foreground">
              {complianceProgress.failing} failing, {complianceProgress.missing} awaiting evidence.
            </p>
          </div>
          <Button variant="outline" className="w-full justify-between" onClick={() => navigate("/compliance")}>
            Open Compliance
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Card>

        <Card className="p-5 space-y-3 border-t-4 border-emerald-400/80 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Analytics</p>
              <h3 className="text-lg font-semibold">Posture Trend</h3>
            </div>
            <Badge variant="secondary" className="text-[11px]">
              {loading ? "..." : data ? "Up to date" : "Pending"}
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center justify-between">
              <span>Risk score</span>
              <strong>{loading ? "..." : data?.statsData.riskScore ?? "-"}</strong>
            </p>
            <p className="flex items-center justify-between">
              <span>Critical vs High</span>
              <strong>
                {loading
                  ? "..."
                  : `${data?.statsData.criticalAlerts.value ?? "-"} / ${data?.statsData.totalThreats.value ?? "-"}`}
              </strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Deep dive visualizations live under Analytics.
            </p>
          </div>
          <Button variant="outline" className="w-full justify-between" onClick={() => navigate("/analytics")}>
            View Analytics
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Card>

        <Card className="p-5 space-y-3 border-t-4 border-slate-400/80 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Reports</p>
              <h3 className="text-lg font-semibold">Pentest Dashboards</h3>
            </div>
            <Badge variant="outline" className="text-[11px]">
              DOCX
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload a DOCX pentest report to build a dashboard that mirrors the live console.
          </p>
          <Button className="w-full justify-between" onClick={() => navigate("/reports")}>
            Go to Reports
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Settings</p>
              <h3 className="text-lg font-semibold">Workspace Controls</h3>
            </div>
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Settings className="h-3 w-3" />
              Config
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage notification rules, integrations, and access controls.
          </p>
          <Button variant="outline" className="w-full justify-between" onClick={() => navigate("/settings")}>
            Open Settings
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Index;
