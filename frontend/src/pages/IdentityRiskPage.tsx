import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, LayoutDashboard, Users, ShieldAlert, Network, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

import OverviewView from "@/components/identity/OverviewView";
import IdentityManagementView from "@/components/identity/IdentityManagementView";
import PrivilegedAccountsView from "@/components/identity/PrivilegedAccountsView";
import AttackPathsView from "@/components/identity/AttackPathsView";
import ComplianceView from "@/components/identity/ComplianceView";
import RemediationView from "@/components/identity/RemediationView";
import IdentityDetailPanel from "@/components/identity/IdentityDetailPanel";

// No mock data imports needed in LIVE mode
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";


interface Identity {
    id: string; email: string; source: string; roles: string[];
    mfaEnabled: boolean; isActive: boolean; riskScore: number;
    privilegeTier: string; exposureLevel: number; attackPathCount: number;
    blastRadius: number; cloudAccounts: string[]; lastLogin: string | null;
    linkedAccounts: string[];
}

const IdentityRiskPage = () => {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState("overview");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [sourceFilter, setSourceFilter] = useState("all");
    const [riskFilter, setRiskFilter] = useState("all");
    const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);

    // Health check for live indicator
    const { data: health } = useQuery({
        queryKey: ["iri-health"],
        queryFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/health`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Health check failed");
            return resp.json();
        },
        refetchInterval: 30000,
        staleTime: 60000,
        enabled: !!token,
    });

    // Summary data
    const { data: summary } = useQuery({
        queryKey: ["identity-summary"],
        queryFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/summary`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Summary fetch failed");
            const data = await resp.json();
            console.log("[API] /summary response:", data);
            return data;
        },
        staleTime: 60000,
        enabled: !!token,
    });

    // Identities list
    const { data: identitiesData, isLoading } = useQuery({
        queryKey: ["identities", searchTerm, page, sourceFilter, riskFilter],
        queryFn: async () => {
            const params = new URLSearchParams({ page: page.toString(), limit: "15", search: searchTerm });
            if (sourceFilter !== "all") params.append("source", sourceFilter);
            if (riskFilter !== "all") params.append("risk_level", riskFilter);
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/identities?${params.toString()}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Identities fetch failed");
            const data = await resp.json();
            console.log("[API] /identities response:", data);
            return data;
        },
        staleTime: 60000,
        enabled: !!token,
    });



    const handleCardClick = (card: string) => {
        if (card === "privilege") setActiveTab("privileged");
        if (card === "mfa") setActiveTab("compliance");
    };

    const queryClient = useQueryClient();

    const exportRiskReport = async () => {
        try {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/risk-data-all`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Failed to fetch data for export");
            const data = await resp.json();

            if (!data || !data.length) return;

            const headers = ["ID", "Email", "Source", "Risk Score", "Privilege Tier", "MFA Enabled", "Is Active", "Roles"];
            const csvRows = [headers.join(',')];

            data.forEach((row: any) => {
                const values = [
                    row.id,
                    row.email || 'N/A',
                    row.source,
                    row.riskScore,
                    row.privilegeTier,
                    row.mfaEnabled,
                    row.isActive,
                    (row.roles || []).join('; ')
                ].map(val => `"${String(val).replace(/"/g, '""')}"`);
                csvRows.push(values.join(','));
            });

            const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `identity_risk_report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Export failed:", error);
        }
    };

    const handleSync = async () => {
        try {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/sync`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (resp.ok) {
                queryClient.invalidateQueries({ queryKey: ["identity"] });
                queryClient.invalidateQueries({ queryKey: ["identities"] });
                queryClient.invalidateQueries({ queryKey: ["dashboard-aggregation"] });
            }
        } catch { /* ignore */ }
    };

    const isLive = health?.status === "healthy";

    const tabs = [
        { id: "overview", label: "IAM Overview", icon: LayoutDashboard },
        { id: "directory", label: "Identity Directory", icon: Users },
        { id: "privileged", label: "Privileged Accounts", icon: ShieldAlert },
        { id: "attack-paths", label: "Attack Paths", icon: Network },
        { id: "compliance", label: "Compliance", icon: ShieldCheck },
        { id: "remediation", label: "Remediation", icon: Zap },
    ];

    return (
        <div className="space-y-6 pb-20">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2  text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-60">
                <span className="hover:text-primary cursor-pointer transition-colors">DASHBOARD</span>
                <span className="opacity-30">/</span>
                <span className="text-foreground tracking-widest">IDENTITY ANALYZER</span>
            </div>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/10 pb-6"
            >
                <div className="space-y-1">
                    <div className="flex items-center gap-4">
                        <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-foreground via-foreground/90 to-foreground/50 bg-clip-text text-transparent">
                            Identity Analyzer
                        </h1>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                            <div className={cn("h-2 w-2 rounded-full", isLive ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-red-500")} />
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Intelligence</span>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium max-w-2xl leading-relaxed opacity-80">
                        Managed IAM security experience for cross-cloud identity exposure, privilege sprawl, and lateral movement detection.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="gap-2 h-10 px-4 text-[11px] font-bold uppercase tracking-widest border-border/40 bg-background/40 backdrop-blur-md shadow-sm hover:bg-background/60 transition-all active:scale-95" onClick={handleSync}>
                        <RefreshCcw className="h-3.5 w-3.5" /> Force Sync
                    </Button>
                    <Button onClick={exportRiskReport} size="sm" className="h-10 px-5 text-[11px] font-bold uppercase tracking-widest gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95">
                        Export Risk Report
                    </Button>
                </div>
            </motion.div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar border-b border-border/10">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all relative group",
                            activeTab === tab.id
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground/80"
                        )}
                    >
                        <tab.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", activeTab === tab.id ? "text-primary" : "text-muted-foreground/60")} />
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="mt-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 5 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -5 }}
                        transition={{ duration: 0.15 }}
                    >
                        {activeTab === "overview" && (
                            <OverviewView
                                summary={summary}
                                identities={identitiesData?.items || []}
                                onCardClick={handleCardClick}
                                onSelectIdentity={setSelectedIdentity}
                            />
                        )}
                        {activeTab === "directory" && (
                            <IdentityManagementView
                                identities={identitiesData?.items || []}
                                isLoading={isLoading}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                sourceFilter={sourceFilter}
                                setSourceFilter={setSourceFilter}
                                riskFilter={riskFilter}
                                setRiskFilter={setRiskFilter}
                                onSelectIdentity={setSelectedIdentity}
                                page={page}
                                setPage={setPage}
                                totalItems={identitiesData?.total || 0}
                            />
                        )}
                        {activeTab === "privileged" && (
                            <PrivilegedAccountsView onSelectIdentity={setSelectedIdentity} />
                        )}
                        {activeTab === "attack-paths" && (
                            <AttackPathsView />
                        )}
                        {activeTab === "compliance" && (
                            <ComplianceView />
                        )}
                        {activeTab === "remediation" && (
                            <RemediationView />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Detail Panel */}
            {selectedIdentity && (
                <IdentityDetailPanel
                    identity={selectedIdentity}
                    onClose={() => setSelectedIdentity(null)}
                />
            )}
        </div>
    );
};

export default IdentityRiskPage;
