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
    ShieldCheck, Github, Users, ChevronDown, ChevronUp, Download, TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";

import type { Identity } from "../../types/identity";

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

const SortIconIndicator = ({ col, sortCol, sortAsc }: { col: string; sortCol: string; sortAsc: boolean }) => (
    sortCol === col ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />) : null
);

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

    return (
        <Card className="border border-border/50 bg-card/60 backdrop-blur-md shadow-lg rounded-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/10 bg-muted/20">
                <div>
                    <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Identity Inventory</CardTitle>
                    <CardDescription className="text-[10px] font-bold text-muted-foreground/60">ENTREPRISE IDENTITY MANAGEMENT ACTIVE</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-2 h-8 text-[10px] font-bold uppercase tracking-widest border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all shadow-md active:scale-95" onClick={exportCsv}>
                    <Download className="h-3.5 w-3.5 text-primary" /> Export CSV
                </Button>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4 mb-6 mt-2">
                    <div className="relative flex-1 min-w-[300px] group">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input placeholder="Search by email, identity ID, or role..." className="pl-10 h-10 text-xs bg-muted/20 border-border/40 focus:bg-background/50 transition-all rounded-lg" value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(() => 1); }} />
                    </div>
                    <div className="flex items-center gap-2">
                        <select className="h-10 w-[140px] rounded-lg border border-border/40 bg-muted/20 px-3 text-[11px] font-bold uppercase tracking-wider focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer" value={sourceFilter}
                            onChange={(e) => { setSourceFilter(e.target.value); setPage(() => 1); }}>
                            <option value="all">ALL SOURCES</option>
                            <option value="aws">AWS</option><option value="azure">AZURE</option><option value="gcp">GCP</option>
                            <option value="okta">OKTA</option><option value="github">GITHUB</option><option value="gitlab">GITLAB</option>
                        </select>
                        <select className="h-10 w-[140px] rounded-lg border border-border/40 bg-muted/20 px-3 text-[11px] font-bold uppercase tracking-wider focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer" value={riskFilter}
                            onChange={(e) => { setRiskFilter(e.target.value); setPage(() => 1); }}>
                            <option value="all">ALL RISK LEVELS</option>
                            <option value="Critical">CRITICAL</option><option value="High">HIGH</option>
                            <option value="Medium">MEDIUM</option><option value="Low">LOW</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-border/30 overflow-hidden bg-background/20 backdrop-blur-sm">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/40 transition-colors border-b border-border/10">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Identity Details</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Source</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 cursor-pointer select-none group" onClick={() => handleSort("privilegeTier")}>
                                    Tier <SortIconIndicator col="privilegeTier" sortCol={sortCol} sortAsc={sortAsc} />
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 cursor-pointer select-none group" onClick={() => handleSort("riskScore")}>
                                    Risk Score <SortIconIndicator col="riskScore" sortCol={sortCol} sortAsc={sortAsc} />
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 cursor-pointer select-none group" onClick={() => handleSort("exposureLevel")}>
                                    Exposure <SortIconIndicator col="exposureLevel" sortCol={sortCol} sortAsc={sortAsc} />
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">MFA</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Cloud Footprint</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 cursor-pointer select-none group" onClick={() => handleSort("attackPathCount")}>
                                    Paths <SortIconIndicator col="attackPathCount" sortCol={sortCol} sortAsc={sortAsc} />
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-right pr-6">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <TableRow key={i} className="animate-pulse">
                                        <TableCell colSpan={9}>
                                            <div className="flex items-center gap-3">
                                                <div className="h-4 w-32 bg-muted/20 rounded" />
                                                <div className="h-8 w-full bg-muted/20 rounded" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : sorted.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-8 text-xs text-muted-foreground">No identities found.</TableCell></TableRow>
                            ) : sorted.map((id) => {
                                const risk = getRiskBadge(id.riskScore);
                                return (
                                    <TableRow
                                        key={`${id.source}-${id.id}`}
                                        className="group cursor-pointer hover:bg-muted/40 transition-all duration-200 border-b border-border/10"
                                        onClick={() => onSelectIdentity(id)}
                                    >
                                        <TableCell className="py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-bold group-hover:text-primary transition-colors">{id.email}</span>
                                                <span className="text-[9px] font-medium text-muted-foreground tracking-tight opacity-60">ID: {id.id}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-muted/20 group-hover:bg-muted/40 transition-colors">
                                                    {getSourceIcon(id.source)}
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider">{id.source}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${getTierBadge(id.privilegeTier)} shadow-inner`}>
                                                {id.privilegeTier}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${risk.cls} shadow-inner`}>
                                                {id.riskScore} · {risk.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-16 h-2 rounded-full bg-muted/20 border border-border/10 overflow-hidden shadow-inner">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${id.exposureLevel}%` }}
                                                        className="h-full rounded-full transition-all duration-1000"
                                                        style={{
                                                            backgroundColor: id.exposureLevel > 80 ? "#ef4444" : id.exposureLevel > 50 ? "#f97316" : "#10b981",
                                                            boxShadow: "0 0 10px rgba(0,0,0,0.1)"
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-black text-muted-foreground/80">{id.exposureLevel}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {id.mfaEnabled ? (
                                                <div className="flex items-center gap-1.5 text-emerald-500">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    <span className="text-[9px] font-black uppercase">Active</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-red-500">
                                                    <XCircle className="h-4 w-4" />
                                                    <span className="text-[9px] font-black uppercase">Disabled</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {id.cloudAccounts?.length > 0 ? id.cloudAccounts.map(cloud => (
                                                    <span key={cloud} className="text-[9px] font-bold bg-muted/20 px-1.5 py-0.5 rounded border border-border/10 uppercase tracking-tighter">{cloud}</span>
                                                )) : <span className="text-[10px] text-muted-foreground opacity-40">NONE</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`text-[11px] font-black flex items-center gap-2 ${id.attackPathCount > 0 ? "text-orange-500" : "text-muted-foreground opacity-40"}`}>
                                                {id.attackPathCount > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : null}
                                                {id.attackPathCount}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary transition-all">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
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
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPage((p) => p + 1)} disabled={page * 15 >= totalItems}>Next</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
