import { useEffect, useMemo, useRef, useState, type ChangeEvent, useCallback } from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import {
    AlertTriangle,
    CheckCircle2,
    FileWarning,
    ShieldCheck,
    ArrowUpRight,
    Filter,
    Download,
    Sparkles,
    UploadCloud,
    Check,
    Ban,
    PencilLine,
    Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { isoQuestions } from "@/data/isoQuestions";
import { useAuth } from "@/contexts/AuthContext";
import BACKEND_URL from "@/lib/api";

type ControlStatus = "Passed" | "Failing" | "Evidence Missing";
type Framework = "SOC 2" | "ISO 27001";
type Risk = "Low" | "Medium" | "High";
type Answer = "yes" | "no" | "skip";

type Control = {
    id: string;
    name: string;
    framework: Framework;
    status: ControlStatus;
    evidence: string;
    risk: Risk;
    aiExplanation: string;
    rootCause: string;
    remediation: string[];
};

type AnswerRecord = { answer: Answer | null; evidenceName?: string };

const trendData = [
    { window: "90d", score: 82 },
    { window: "60d", score: 85 },
    { window: "45d", score: 88 },
    { window: "30d", score: 91 },
    { window: "14d", score: 93 },
];

const statusBadgeStyles: Record<ControlStatus, string> = {
    Passed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    Failing: "bg-destructive/10 text-destructive border border-destructive/30",
    "Evidence Missing": "bg-amber-50 text-amber-700 border border-amber-200",
};

const riskStyles: Record<Risk, string> = {
    Low: "bg-emerald-50 text-emerald-700",
    Medium: "bg-amber-50 text-amber-700",
    High: "bg-destructive/10 text-destructive",
};

export default function Compliance() {
    const { token } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [frameworkFilter, setFrameworkFilter] = useState<Framework | "All">("ISO 27001");
    const [statusFilter, setStatusFilter] = useState<ControlStatus | "All">("All");
    const [selectedControl, setSelectedControl] = useState<Control | null>(null);
    const [enabledFrameworks] = useState<Framework[]>(["ISO 27001"]); // SOC 2 toggle coming soon
    const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
    const [questionnaireComplete, setQuestionnaireComplete] = useState(false);
    const [showQuestionnaire, setShowQuestionnaire] = useState(true);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);

    const fetchCompliance = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/compliance`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.answers) setAnswers(data.answers);
                if (data.complete) {
                    setQuestionnaireComplete(data.complete);
                    setShowQuestionnaire(!data.complete);
                }
            }
        } catch (e) {
            console.warn("Failed to load compliance data", e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchCompliance();
    }, [fetchCompliance]);

    const saveToBackend = async (newAnswers: Record<string, AnswerRecord>, isComplete: boolean) => {
        if (!token) return;
        setSaving(true);
        try {
            await fetch(`${BACKEND_URL}/api/compliance`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ answers: newAnswers, complete: isComplete })
            });
        } catch (e) {
            console.error("Failed to save", e);
        } finally {
            setSaving(false);
        }
    };

    const handleAnswerChange = (id: string, value: Answer) => {
        const newAnswers = {
            ...answers,
            [id]: {
                ...(answers[id] || {}),
                answer: value,
            },
        };
        setAnswers(newAnswers);
        saveToBackend(newAnswers, questionnaireComplete);
    };

    const handleEvidenceClick = (id: string) => {
        setUploadingFor(id);
        fileInputRef.current?.click();
    };

    const handleEvidenceUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingFor) return;

        const newAnswers = {
            ...answers,
            [uploadingFor]: {
                ...(answers[uploadingFor] || {}),
                evidenceName: file.name,
            },
        };
        setAnswers(newAnswers);
        setUploadingFor(null);
        e.target.value = "";
        saveToBackend(newAnswers, questionnaireComplete);
    };

    const openQuestionnaire = () => {
        setShowQuestionnaire(true);
    };

    const submitQuestionnaire = () => {
        setQuestionnaireComplete(true);
        setShowQuestionnaire(false);
        saveToBackend(answers, true);
    };

    const allQuestionsAnswered = useMemo(
        () => isoQuestions.every((q) => answers[q.id]?.answer),
        [answers],
    );

    const isoControls = useMemo<Control[]>(
        () =>
            isoQuestions.map((item) => {
                const record = answers[item.id] ?? { answer: null };
                let status: ControlStatus = "Evidence Missing";
                if (record.answer === "yes") {
                    status = item.requiresEvidence ? (record.evidenceName ? "Passed" : "Evidence Missing") : "Passed";
                } else if (record.answer === "no") {
                    status = "Failing";
                }

                const evidence = item.requiresEvidence
                    ? record.evidenceName || "Evidence pending"
                    : "Not required";

                return {
                    id: item.id,
                    name: item.question,
                    framework: "ISO 27001",
                    status,
                    evidence,
                    risk: item.risk,
                    aiExplanation: item.evidenceHint,
                    rootCause: item.defaultRootCause,
                    remediation: item.remediation,
                } satisfies Control;
            }),
        [answers],
    );

    const allControls = useMemo<Control[]>(() => {
        const soc2 = enabledFrameworks.includes("SOC 2") ? [] : [];
        return [...soc2, ...isoControls];
    }, [enabledFrameworks, isoControls]);

    const summary = useMemo(() => {
        const passed = allControls.filter((c) => c.status === "Passed").length;
        const failing = allControls.filter((c) => c.status === "Failing").length;
        const missing = allControls.filter((c) => c.status === "Evidence Missing").length;
        const total = allControls.length || 1;
        const score = Math.max(60, Math.round((passed / total) * 100));
        return { passed, failing, missing, score };
    }, [allControls]);

    const filteredControls = useMemo(
        () =>
            allControls.filter(
                (control) =>
                    (frameworkFilter === "All" || control.framework === frameworkFilter) &&
                    (statusFilter === "All" || control.status === statusFilter),
            ),
        [allControls, frameworkFilter, statusFilter],
    );

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Render questionnaire gate
    if (!questionnaireComplete || showQuestionnaire) {
        return (
            <div className="space-y-6 w-full max-w-6xl animate-fade-in">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Compliance Intake</p>
                        <h1 className="text-xl font-bold">ISO 27001 Readiness Questionnaire</h1>
                        <p className="text-sm text-muted-foreground">
                            Answer each control (Yes / No / Skip). Skips are allowed. Evidence can be added later inside the dashboard.
                        </p>
                    </div>
                    <Badge variant="secondary" className="text-[11px]">Required before dashboard</Badge>
                </div>

                <Card className="p-4 border-dashed border-muted-foreground/40 bg-card/60 shadow-none">
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-semibold">Frameworks in scope</p>
                        <Badge className="bg-secondary text-foreground border border-border text-[11px]">ISO 27001 (enabled)</Badge>
                        <Badge variant="outline" className="text-[11px] text-muted-foreground border-dashed">SOC 2 (coming soon)</Badge>
                    </div>
                </Card>

                <div className="space-y-3">
                    {isoQuestions.map((item) => {
                        const response = answers[item.id]?.answer ?? null;
                        const evidenceName = answers[item.id]?.evidenceName;
                        const needsEvidenceUpload = item.requiresEvidence && response === "yes" && !evidenceName;

                        return (
                            <Card key={item.id} className="p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-[11px]">{item.controlRef}</Badge>
                                        <span className="text-sm font-semibold">{item.title}</span>
                                        <span className="text-[11px] text-muted-foreground">{item.domain}</span>
                                    </div>
                                    {item.requiresEvidence && (
                                        <Badge className="bg-secondary text-foreground border border-border text-[11px]">Evidence required later</Badge>
                                    )}
                                </div>

                                <p className="text-sm text-foreground mb-3">{item.question}</p>

                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <RadioGroup
                                        className="grid grid-cols-3 gap-2 max-w-md"
                                        value={response ?? undefined}
                                        onValueChange={(v) => handleAnswerChange(item.id, v as Answer)}
                                    >
                                        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-secondary/70">
                                            <RadioGroupItem value="yes" />
                                            <span>Yes</span>
                                        </label>
                                        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-secondary/70">
                                            <RadioGroupItem value="no" />
                                            <span>No</span>
                                        </label>
                                        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-secondary/70">
                                            <RadioGroupItem value="skip" />
                                            <span>Skip</span>
                                        </label>
                                    </RadioGroup>

                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        {!response && <span className="text-destructive">Select Yes / No / Skip</span>}
                                        {response === "yes" && !item.requiresEvidence && <span>Will show as Passed</span>}
                                        {response === "yes" && item.requiresEvidence && (
                                            <span className={needsEvidenceUpload ? "text-amber-700" : "text-emerald-700"}>
                                                {needsEvidenceUpload ? "Needs evidence to pass later" : "Evidence attached"}
                                            </span>
                                        )}
                                        {response === "no" && <span className="text-destructive">Will show as Failing</span>}
                                        {response === "skip" && <span>Will show as Evidence Missing</span>}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground flex gap-2 items-center">
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Evidence uploads happen inside the dashboard after you submit answers.
                    </p>
                    <Button
                        className="h-9 px-4 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={!allQuestionsAnswered || saving}
                        onClick={submitQuestionnaire}
                    >
                        Continue to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full max-w-6xl animate-fade-in">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Compliance Automation</p>
                    <div className="flex gap-2 items-center">
                        <h1 className="text-xl font-bold">Be4Breach Compliance Dashboard</h1>
                        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Dashboard reflects your questionnaire responses. Evidence can be attached on failing or pending controls.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Select value={frameworkFilter} onValueChange={(v) => setFrameworkFilter(v as Framework | "All")}>
                        <SelectTrigger className="h-9 rounded-full bg-secondary border border-border px-4 text-sm">
                            <Filter className="h-4 w-4 text-muted-foreground mr-2" />
                            <SelectValue placeholder="Framework" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="All">All Frameworks</SelectItem>
                            <SelectItem value="ISO 27001">ISO 27001</SelectItem>
                            <SelectItem value="SOC 2">SOC 2</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ControlStatus | "All")}>
                        <SelectTrigger className="h-9 rounded-full bg-secondary border border-border px-4 text-sm">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Passed">Passed</SelectItem>
                            <SelectItem value="Failing">Failing</SelectItem>
                            <SelectItem value="Evidence Missing">Evidence Missing</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="secondary"
                        className="h-9 px-3"
                        onClick={openQuestionnaire}
                    >
                        <PencilLine className="h-4 w-4" />
                        Edit Answers
                    </Button>

                    <Button className="h-9 px-4 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm">
                        <Download className="h-4 w-4" />
                        Generate Audit Report
                    </Button>
                </div>
            </div>

            <Card className="p-4 border-dashed border-muted-foreground/40 bg-card/60 shadow-none">
                <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold">Frameworks enabled</p>
                    <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-full px-3 py-1 h-8 bg-secondary text-foreground border border-border"
                    >
                        <Check className="h-4 w-4 text-emerald-600" /> ISO 27001 (live)
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="rounded-full px-3 py-1 h-8 text-muted-foreground border-dashed"
                    >
                        <Ban className="h-4 w-4" /> SOC 2 (coming soon)
                    </Button>
                </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card className="p-5 flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Overall Compliance Score</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">{summary.score}%</span>
                            <Badge variant="secondary" className="text-[11px] border border-border">
                                Audit Readiness
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Driven by Yes/No/Skip selections</p>
                    </div>
                    <div className="relative h-16 w-16">
                        <div
                            className="absolute inset-0 rounded-full"
                            style={{
                                background: `conic-gradient(#E10600 ${summary.score * 3.6}deg, #F5F5F5 ${summary.score * 3.6}deg)`,
                            }}
                        />
                        <div className="absolute inset-1 rounded-full bg-white border border-border flex items-center justify-center">
                            <span className="text-sm font-semibold">{summary.score}%</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-5 flex items-start justify-between shadow-sm">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Passed Controls</p>
                        <p className="text-2xl font-bold text-foreground">{summary.passed}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>Yes answers with proof</span>
                        </div>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">Healthy</Badge>
                </Card>

                <Card className="p-5 flex items-start justify-between shadow-sm">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Failing Controls</p>
                        <p className="text-2xl font-bold text-destructive">{summary.failing}</p>
                        <div className="flex items-center gap-2 text-xs text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <span>No answers flagged</span>
                        </div>
                    </div>
                    <Badge className="bg-destructive/10 text-destructive border border-destructive/30 text-[11px]">Critical</Badge>
                </Card>

                <Card className="p-5 flex items-start justify-between shadow-sm">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Evidence Missing</p>
                        <p className="text-2xl font-bold text-amber-700">{summary.missing}</p>
                        <div className="flex items-center gap-2 text-xs text-amber-700">
                            <FileWarning className="h-4 w-4" />
                            <span>Yes/skip answers needing proof</span>
                        </div>
                    </div>
                    <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px]">Gaps</Badge>
                </Card>
            </div>

            <Card className="p-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-sm font-semibold">Evidence Upload (post-questionnaire)</h3>
                        <p className="text-xs text-muted-foreground">Click failing or pending controls below to add proof. Team review happens later.</p>
                    </div>
                    <Badge variant="secondary" className="text-[11px]">Client can upload after answers</Badge>
                </div>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="xl:col-span-2 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold">Control Status</h3>
                            <p className="text-xs text-muted-foreground">Built directly from your questionnaire responses.</p>
                        </div>
                        <Badge variant="secondary" className="text-[11px]">
                            {filteredControls.length} controls shown
                        </Badge>
                    </div>

                    <div className="rounded-lg border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/60">
                                <TableRow>
                                    <TableHead className="w-24">Control ID</TableHead>
                                    <TableHead>Control Name</TableHead>
                                    <TableHead>Framework</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Evidence</TableHead>
                                    <TableHead>Risk</TableHead>
                                    <TableHead className="text-right pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredControls.map((control) => (
                                    <TableRow
                                        key={control.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => setSelectedControl(control)}
                                    >
                                        <TableCell className="font-semibold text-sm">{control.id}</TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium">{control.name}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {control.status === "Failing"
                                                        ? "Marked No in questionnaire."
                                                        : control.status === "Evidence Missing"
                                                            ? "Evidence needs upload."
                                                            : "In compliance"}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-[11px]">
                                                {control.framework}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn("text-[11px]", statusBadgeStyles[control.status])}>
                                                {control.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{control.evidence}</TableCell>
                                        <TableCell>
                                            <span
                                                className={cn(
                                                    "px-2 py-1 rounded-full text-[11px] font-medium",
                                                    riskStyles[control.risk],
                                                )}
                                            >
                                                {control.risk}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right pr-4">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:bg-destructive/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedControl(control);
                                                }}
                                            >
                                                Review
                                                <ArrowUpRight className="h-3.5 w-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {filteredControls.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-6 text-sm text-muted-foreground">
                                            No controls match this filter set.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>

                <Card className="p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold">Compliance Trend</h3>
                            <p className="text-xs text-muted-foreground">Score trajectory across 90/60/30 day windows.</p>
                        </div>
                        <Badge variant="secondary" className="text-[11px]">
                            Auto-updated
                        </Badge>
                    </div>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 10, right: 6, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,92%)" />
                                <XAxis dataKey="window" stroke="hsl(0,0%,64%)" tickLine={false} axisLine={false} />
                                <YAxis
                                    domain={[80, 100]}
                                    stroke="hsl(0,0%,64%)"
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `${v}%`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "white",
                                        border: "1px solid hsl(0,0%,90%)",
                                        borderRadius: "0.5rem",
                                        fontSize: 12,
                                    }}
                                    formatter={(value: any) => [`${value}%`, "Score"]}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#111111"
                                    strokeWidth={2}
                                    dot={{ stroke: "#E10600", strokeWidth: 2, r: 4, fill: "#ffffff" }}
                                    activeDot={{ r: 6, fill: "#E10600" }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-destructive" />
                        <span>Score will rise as evidence is attached or gaps are resolved.</span>
                    </div>
                </Card>
            </div>

            <Sheet open={!!selectedControl} onOpenChange={(open) => !open && setSelectedControl(null)}>
                <SheetContent side="right" className="w-full sm:max-w-lg">
                    {selectedControl && (
                        <>
                            <SheetHeader>
                                <Badge className={cn("w-fit text-[11px]", statusBadgeStyles[selectedControl.status])}>
                                    {selectedControl.status}
                                </Badge>
                                <SheetTitle className="text-lg font-semibold leading-tight">
                                    {selectedControl.id} - {selectedControl.name}
                                </SheetTitle>
                                <p className="text-xs text-muted-foreground">
                                    {selectedControl.framework} - Risk {selectedControl.risk}
                                </p>
                            </SheetHeader>

                            <ScrollArea className="mt-4 h-[70vh] pr-2">
                                <div className="space-y-4">
                                    <div className="p-3 rounded-lg bg-secondary border border-border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShieldCheck className="h-4 w-4 text-destructive" />
                                            <p className="text-xs font-semibold uppercase tracking-wide">AI Explanation</p>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{selectedControl.aiExplanation}</p>
                                    </div>

                                    <div className="p-3 rounded-lg bg-card border">
                                        <p className="text-xs font-semibold text-foreground mb-1">Technical Root Cause</p>
                                        <p className="text-sm text-muted-foreground">{selectedControl.rootCause}</p>
                                    </div>

                                    {selectedControl.remediation.length > 0 && (
                                        <div className="p-3 rounded-lg bg-card border">
                                            <p className="text-xs font-semibold text-foreground mb-2">Recommended Remediation</p>
                                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                                {selectedControl.remediation.map((step, idx) => (
                                                    <li key={idx}>{step}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {selectedControl.status !== "Passed" && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-dashed"
                                                onClick={() => handleEvidenceClick(selectedControl.id)}
                                            >
                                                <UploadCloud className="h-4 w-4" />
                                                {answers[selectedControl.id]?.evidenceName ? "Replace evidence" : "Upload evidence"}
                                            </Button>
                                            <span className="text-xs text-muted-foreground">
                                                {answers[selectedControl.id]?.evidenceName || "Attach proof to move this control to Passed."}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 border-destructive text-destructive" size="sm">
                                            Mark as Resolved
                                        </Button>
                                        <Button variant="secondary" className="flex-1" size="sm" onClick={() => setSelectedControl(null)}>
                                            Close
                                        </Button>
                                    </div>
                                </div>
                            </ScrollArea>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleEvidenceUpload}
            />
        </div>
    );
}
