import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PentestReport } from "@/types/pentest-report";
import { AlertTriangle, ClipboardList, Gauge, ShieldCheck, Target } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

type Props = {
    report: PentestReport;
};

const severityStyles: Record<string, string> = {
    Critical: "bg-destructive text-destructive-foreground",
    High: "bg-threat-high text-white",
    Medium: "bg-threat-medium text-white",
    Low: "bg-threat-low text-white",
};

const statusColors: Record<string, string> = {
    Open: "text-destructive",
    "In Progress": "text-threat-high",
    Resolved: "text-threat-safe",
    Accepted: "text-muted-foreground",
    Unknown: "text-muted-foreground",
};

export const ReportDashboard = ({ report }: Props) => {
    const [selected, setSelected] = useState<PentestReport["findings"][number] | null>(null);

    const totalSeverity = report.severityChart.reduce((sum, item) => sum + item.value, 0);
    const openCount = report.statusBreakdown.find((s) => s.status === "Open")?.count ?? 0;
    const resolvedCount = report.statusBreakdown.find((s) => s.status === "Resolved")?.count ?? 0;
    const inProgressCount = report.statusBreakdown.find((s) => s.status === "In Progress")?.count ?? 0;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card className="p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Total Findings</p>
                        <p className="text-2xl font-bold">{report.totalFindings}</p>
                        <p className="text-[11px] text-muted-foreground">Parsed from the uploaded report</p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary">
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    </div>
                </Card>

                <Card className="p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Critical Issues</p>
                        <p className="text-2xl font-bold text-destructive">{report.summary?.critical ?? 0}</p>
                        <p className="text-[11px] text-muted-foreground">Priority for remediation</p>
                    </div>
                    <div className="p-2 rounded-lg bg-destructive/10">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                </Card>

                <Card className="p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Average CVSS</p>
                        <p className="text-2xl font-bold">{report.cvss?.average ?? "-"}</p>
                        <p className="text-[11px] text-muted-foreground">
                            Range {report.cvss ? `${report.cvss.min}-${report.cvss.max}` : "n/a"}
                        </p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary">
                        <Gauge className="h-5 w-5 text-muted-foreground" />
                    </div>
                </Card>

                <Card className="p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Open Items</p>
                        <p className="text-2xl font-bold">{openCount}</p>
                        <p className="text-[11px] text-muted-foreground">{resolvedCount} resolved | {inProgressCount} in progress</p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary">
                        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="p-5 xl:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold">Severity Breakdown</h3>
                        <Badge variant="outline" className="text-[11px]">
                            {totalSeverity} total
                        </Badge>
                    </div>
                    <div className="h-64 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={report.severityChart}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={4}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {report.severityChart.map((entry) => (
                                        <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(0,0%,100%)",
                                        border: "1px solid hsl(0,0%,90%)",
                                        borderRadius: "0.5rem",
                                        fontSize: 12,
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-2xl font-bold">{totalSeverity}</p>
                                <p className="text-[10px] text-muted-foreground">Findings</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        {report.severityChart.map((item) => (
                            <div key={item.name} className="flex items-center gap-2 text-xs">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-muted-foreground">{item.name}</span>
                                <span className="ml-auto font-medium">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Engagement Details</h3>
                        <Badge variant="secondary" className="text-[11px]">
                            Imported
                        </Badge>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div>
                            <p className="text-[11px] uppercase text-muted-foreground">Client</p>
                            <p className="font-medium">{report.engagement?.client ?? "Not provided"}</p>
                        </div>
                        <div>
                            <p className="text-[11px] uppercase text-muted-foreground">Report Date</p>
                            <p className="font-medium">{report.engagement?.reportDate ?? "Not provided"}</p>
                        </div>
                        <div>
                            <p className="text-[11px] uppercase text-muted-foreground">Audit Type</p>
                            <p className="font-medium">{report.engagement?.auditType ?? "Not provided"}</p>
                        </div>
                    </div>
                    <div className="rounded-lg border p-3 bg-secondary/50 space-y-2">
                        <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-destructive" />
                            <p className="text-xs font-semibold">Top Risks</p>
                        </div>
                        <div className="space-y-2">
                            {report.topFindings.length === 0 && (
                                <p className="text-[11px] text-muted-foreground">No findings detected in the file.</p>
                            )}
                            {report.topFindings.map((finding) => (
                                <button
                                    key={finding.id}
                                    onClick={() => setSelected(finding)}
                                    className="flex items-start gap-2 w-full text-left hover:bg-secondary/60 rounded-md p-1 transition-colors"
                                >
                                    <Badge className={cn("text-[10px] mt-0.5", severityStyles[finding.severity ?? ""])}>{finding.severity ?? "N/A"}</Badge>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium truncate">{finding.title ?? "Untitled finding"}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            CVSS {finding.cvssScore ?? "n/a"} {finding.cwe ? `| ${finding.cwe}` : ""}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Status Breakdown</h3>
                        <Badge variant="outline" className="text-[11px]">
                            Workflow
                        </Badge>
                    </div>
                    <div className="space-y-3">
                        {report.statusBreakdown.length === 0 && (
                            <p className="text-xs text-muted-foreground">No status information found in the report.</p>
                        )}
                        {report.statusBreakdown.map((item) => {
                            const percentage = report.totalFindings ? Math.round((item.count / report.totalFindings) * 100) : 0;
                            return (
                                <div key={item.status} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <p className={cn("font-medium", statusColors[item.status] ?? "text-foreground")}>{item.status}</p>
                                        <span className="text-muted-foreground">{item.count} | {percentage}%</span>
                                    </div>
                                    <Progress value={percentage} className="h-2" />
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <Card className="p-5 xl:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-sm font-semibold">Findings</h3>
                            <p className="text-xs text-muted-foreground">Pulled directly from the uploaded report</p>
                        </div>
                        <Badge variant="secondary" className="text-[11px]">
                            {report.findings.length} entries
                        </Badge>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">ID</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead className="w-28">Severity</TableHead>
                                    <TableHead className="w-24">CVSS</TableHead>
                                    <TableHead className="w-28">CWE</TableHead>
                                    <TableHead className="w-32">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.findings.map((finding) => (
                                    <TableRow
                                        key={finding.id}
                                        className="cursor-pointer hover:bg-secondary/50"
                                        onClick={() => setSelected(finding)}
                                    >
                                        <TableCell className="text-xs text-muted-foreground">#{finding.id}</TableCell>
                                        <TableCell className="font-medium text-sm">{finding.title ?? "Untitled finding"}</TableCell>
                                        <TableCell>
                                            <Badge className={cn("text-[11px]", severityStyles[finding.severity ?? ""])}>{finding.severity ?? "N/A"}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">{finding.cvssScore ?? "-"}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{finding.cwe ?? "-"}</TableCell>
                                        <TableCell className="text-xs">{finding.status ?? "-"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>

            <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
                <DialogContent className="max-w-6xl w-[96vw] h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selected?.severity && (
                                <Badge className={cn("text-[10px]", severityStyles[selected.severity])}>
                                    {selected.severity}
                                </Badge>
                            )}
                            <span className="text-base font-semibold leading-tight">{selected?.title ?? "Finding details"}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {selected?.cwe && <span className="mr-2">CWE: {selected.cwe}</span>}
                            {selected?.cvssScore !== undefined && <span>CVSS: {selected.cvssScore}</span>}
                        </DialogDescription>
                    </DialogHeader>

                    {selected && (
                        <div className="space-y-4 text-sm">
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary" className="text-[11px]">Status: {selected.status ?? "Not specified"}</Badge>
                                <Badge variant="secondary" className="text-[11px]">CVSS: {selected.cvssScore ?? "n/a"}</Badge>
                                {selected.affectedAsset && (
                                    <Badge variant="secondary" className="text-[11px] max-w-sm truncate">
                                        Asset: {selected.affectedAsset}
                                    </Badge>
                                )}
                            </div>

                            {selected.description && (
                                <section className="space-y-1">
                                    <p className="text-[11px] uppercase text-muted-foreground">Description</p>
                                    <p className="leading-relaxed text-foreground">{selected.description}</p>
                                </section>
                            )}

                            {selected.impact && (
                                <section className="space-y-1">
                                    <p className="text-[11px] uppercase text-muted-foreground">Impact</p>
                                    <p className="leading-relaxed text-foreground">{selected.impact}</p>
                                </section>
                            )}

                            {selected.recommendations && (
                                <section className="space-y-1">
                                    <p className="text-[11px] uppercase text-muted-foreground">Recommendations</p>
                                    <p className="leading-relaxed text-foreground">{selected.recommendations}</p>
                                </section>
                            )}

                            {selected.poc && (
                                <section className="space-y-2">
                                    <p className="text-[11px] uppercase text-muted-foreground">Proof of Concept</p>
                                    <p className="leading-relaxed text-foreground whitespace-pre-wrap">{selected.poc}</p>
                                    {selected.pocImages && selected.pocImages.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {selected.pocImages.map((src, idx) => (
                                                <div key={idx} className="border rounded-lg overflow-hidden bg-muted/30">
                                                    <img src={src} alt={`PoC ${idx + 1}`} className="w-full h-full object-contain max-h-72" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}

                            {selected.references && (
                                <section className="space-y-1">
                                    <p className="text-[11px] uppercase text-muted-foreground">References</p>
                                    <p className="leading-relaxed text-foreground">{selected.references}</p>
                                </section>
                            )}

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={() => setSelected(null)}
                                    className="h-9 px-4 rounded-md border text-sm font-medium hover:bg-secondary transition-colors"
                                >
                                    Back
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
