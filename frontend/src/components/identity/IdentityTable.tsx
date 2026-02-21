import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Search, MoreVertical, CheckCircle2, XCircle, Cloud, Fingerprint,
    ShieldCheck, Github, Users, ChevronDown, ChevronUp, Download,
} from "lucide-react";

interface Identity {
    id: string; email: string; source: string; roles: string[];
    mfaEnabled: boolean; isActive: boolean; riskScore: number;
    privilegeTier: string; exposureLevel: number; attackPathCount: number;
    blastRadius: number; cloudAccounts: string[]; lastLogin: string | null;
    linkedAccounts: string[];
}

interface Props {
    identities: Identity[];
    isLoading: boolean;
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    page: number;
    setPage: (fn: (p: number) => number) => void;
    sourceFilter: string;
    setSourceFilter: (v: string) => void;
    riskFilter: string;
    setRiskFilter: (v: string) => void;
    totalItems: number;
    onSelectIdentity: (id: Identity) => void;
}

function getRiskBadge(score: number) {
    if (score >= 80) return { label: "Critical", cls: "bg-threat-critical/15 text-threat-critical border-threat-critical/30" };
    if (score >= 61) return { label: "High", cls: "bg-threat-high/15 text-threat-high border-threat-high/30" };
    if (score >= 31) return { label: "Medium", cls: "bg-threat-medium/15 text-threat-medium border-threat-medium/30" };
    return { label: "Low", cls: "bg-threat-safe/15 text-threat-safe border-threat-safe/30" };
}

function getTierBadge(tier: string) {
    const map: Record<string, string> = {
        critical: "bg-threat-critical/15 text-threat-critical border-threat-critical/30",
        high: "bg-threat-high/15 text-threat-high border-threat-high/30",
        medium: "bg-threat-medium/15 text-threat-medium border-threat-medium/30",
        low: "bg-threat-safe/15 text-threat-safe border-threat-safe/30",
    };
    return map[tier] ?? map.low;
}

function getSourceIcon(source: string) {
    switch (source) {
        case "aws": return <Cloud className="h-3.5 w-3.5 text-orange-500" />;
        case "github": return <Github className="h-3.5 w-3.5" />;
        case "okta": return <Fingerprint className="h-3.5 w-3.5 text-blue-500" />;
        case "azure": return <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />;
        case "gcp": return <Cloud className="h-3.5 w-3.5 text-blue-600" />;
        default: return <Users className="h-3.5 w-3.5" />;
    }
}

export default function IdentityTable({
    identities, isLoading, searchTerm, setSearchTerm, page, setPage,
    sourceFilter, setSourceFilter, riskFilter, setRiskFilter,
    totalItems, onSelectIdentity,
}: Props) {
    const [sortCol, setSortCol] = useState<string>("riskScore");
    const [sortAsc, setSortAsc] = useState(false);

    const handleSort = (col: string) => {
        if (sortCol === col) setSortAsc(!sortAsc);
        else { setSortCol(col); setSortAsc(false); }
    };

    const sorted = [...identities].sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[sortCol];
        const bv = (b as unknown as Record<string, unknown>)[sortCol];
        if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
        return 0;
    });

    const exportCsv = () => {
        const hdr = ["Email", "Source", "Privilege Tier", "Risk Score", "Exposure", "MFA", "Cloud Accounts", "Attack Paths", "Status"];
        const rows = identities.map((i) => [
            i.email, i.source, i.privilegeTier, i.riskScore, i.exposureLevel,
            i.mfaEnabled ? "Yes" : "No", i.cloudAccounts.join(";"), i.attackPathCount, i.isActive ? "Active" : "Inactive",
        ]);
        const csv = [hdr, ...rows].map((r) => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "identities.csv"; a.click();
    };

    const SortIcon = ({ col }: { col: string }) => (
        sortCol === col ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />) : null
    );

    return (
        <Card className="border border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-sm font-semibold">Identity Inventory</CardTitle>
                    <CardDescription className="text-xs">Enterprise identity management across all providers</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={exportCsv}>
                    <Download className="h-3 w-3" /> CSV
                </Button>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input placeholder="Search email, ID..." className="pl-8 h-8 text-xs" value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(() => 1); }} />
                    </div>
                    <select className="h-8 w-[130px] rounded-md border border-input bg-transparent px-2 text-xs" value={sourceFilter}
                        onChange={(e) => { setSourceFilter(e.target.value); setPage(() => 1); }}>
                        <option value="all">All Sources</option>
                        <option value="aws">AWS</option><option value="azure">Azure</option><option value="gcp">GCP</option>
                        <option value="okta">Okta</option><option value="github">GitHub</option><option value="gitlab">GitLab</option>
                    </select>
                    <select className="h-8 w-[130px] rounded-md border border-input bg-transparent px-2 text-xs" value={riskFilter}
                        onChange={(e) => { setRiskFilter(e.target.value); setPage(() => 1); }}>
                        <option value="all">All Risk</option>
                        <option value="Critical">Critical</option><option value="High">High</option>
                        <option value="Medium">Medium</option><option value="Low">Low</option>
                    </select>
                </div>

                {/* Table */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-xs">Email</TableHead>
                                <TableHead className="text-xs">Source</TableHead>
                                <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort("privilegeTier")}>Privilege Tier <SortIcon col="privilegeTier" /></TableHead>
                                <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort("riskScore")}>Risk Score <SortIcon col="riskScore" /></TableHead>
                                <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort("exposureLevel")}>Exposure <SortIcon col="exposureLevel" /></TableHead>
                                <TableHead className="text-xs">MFA</TableHead>
                                <TableHead className="text-xs">Clouds</TableHead>
                                <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort("attackPathCount")}>Paths <SortIcon col="attackPathCount" /></TableHead>
                                <TableHead className="text-xs text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-8 text-xs text-muted-foreground">Loading...</TableCell></TableRow>
                            ) : sorted.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-8 text-xs text-muted-foreground">No identities found.</TableCell></TableRow>
                            ) : sorted.map((id) => {
                                const risk = getRiskBadge(id.riskScore);
                                return (
                                    <TableRow key={`${id.source}-${id.id}`} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => onSelectIdentity(id)}>
                                        <TableCell>
                                            <div><span className="text-xs font-medium">{id.email}</span></div>
                                            <span className="text-[10px] text-muted-foreground">{id.id}</span>
                                        </TableCell>
                                        <TableCell><div className="flex items-center gap-1.5">{getSourceIcon(id.source)}<span className="text-xs capitalize">{id.source}</span></div></TableCell>
                                        <TableCell><Badge variant="outline" className={`text-[10px] ${getTierBadge(id.privilegeTier)}`}>{id.privilegeTier}</Badge></TableCell>
                                        <TableCell><Badge variant="outline" className={`text-[10px] ${risk.cls}`}>{id.riskScore} · {risk.label}</Badge></TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${id.exposureLevel}%`, backgroundColor: id.exposureLevel > 60 ? "var(--threat-critical)" : id.exposureLevel > 30 ? "var(--threat-medium)" : "var(--threat-safe)" }} />
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">{id.exposureLevel}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{id.mfaEnabled ? <CheckCircle2 className="h-3.5 w-3.5 text-threat-safe" /> : <XCircle className="h-3.5 w-3.5 text-threat-critical" />}</TableCell>
                                        <TableCell><span className="text-[10px]">{id.cloudAccounts?.join(", ") ?? "-"}</span></TableCell>
                                        <TableCell><span className={`text-xs font-medium ${id.attackPathCount > 0 ? "text-orange-400" : ""}`}>{id.attackPathCount}</span></TableCell>
                                        <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-3 w-3" /></Button></TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-3">
                    <p className="text-[10px] text-muted-foreground">Showing {sorted.length} of {totalItems}</p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                        <span className="text-xs font-medium">Page {page}</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPage((p) => p + 1)} disabled={sorted.length < 10}>Next</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
