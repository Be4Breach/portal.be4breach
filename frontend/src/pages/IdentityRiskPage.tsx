import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCcw, LayoutDashboard, Users, ShieldAlert, Network, FileCheck, LifeBuoy } from "lucide-react";
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

import { DEMO_MODE } from "@/api/demoConfig";
import { MOCK_IDENTITY_SUMMARY, MOCK_IDENTITIES, MOCK_HEALTH } from "@/mocks/identityMockData";

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
            if (DEMO_MODE) return MOCK_HEALTH;
            try {
                const resp = await fetch("/api/identity-risk-intelligence/health", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!resp.ok) return MOCK_HEALTH; // Fallback to mock on error
                return resp.json();
            } catch (err) {
                console.warn("API Error, falling back to mock:", err);
                return MOCK_HEALTH;
            }
        },
        refetchInterval: 15000,
        enabled: !!token,
    });

    // Summary data
    const { data: summary, refetch: refetchSummary } = useQuery({
        queryKey: ["identity-summary"],
        queryFn: async () => {
            if (DEMO_MODE) return MOCK_IDENTITY_SUMMARY;
            try {
                const resp = await fetch("/api/identity-risk-intelligence/summary", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!resp.ok) return MOCK_IDENTITY_SUMMARY;
                return resp.json();
            } catch (err) {
                console.warn("API Error, falling back to mock:", err);
                return MOCK_IDENTITY_SUMMARY;
            }
        },
        enabled: !!token,
    });

    // Identities list
    const { data: identitiesData, isLoading } = useQuery({
        queryKey: ["identities", searchTerm, page, sourceFilter, riskFilter],
        queryFn: async () => {
            if (DEMO_MODE) {
                let filtered = [...MOCK_IDENTITIES];
                if (searchTerm) {
                    filtered = filtered.filter(i => i.email.toLowerCase().includes(searchTerm.toLowerCase()));
                }
                if (sourceFilter !== "all") {
                    filtered = filtered.filter(i => i.source === sourceFilter);
                }
                if (riskFilter !== "all") {
                    filtered = filtered.filter(i => i.privilegeTier.toLowerCase() === riskFilter.toLowerCase());
                }
                return { items: filtered, total: filtered.length };
            }
            try {
                const params = new URLSearchParams({ page: page.toString(), limit: "15", search: searchTerm });
                if (sourceFilter !== "all") params.append("source", sourceFilter);
                if (riskFilter !== "all") params.append("risk_level", riskFilter);
                const resp = await fetch(`/api/identity-risk-intelligence/identities?${params.toString()}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!resp.ok) return { items: MOCK_IDENTITIES.slice(0, 5), total: 5 };
                return resp.json();
            } catch (err) {
                console.warn("API Error, falling back to mock:", err);
                return { items: MOCK_IDENTITIES.slice(0, 5), total: 5 };
            }
        },
        enabled: !!token,
    });

    const identities: Identity[] = identitiesData?.items ?? [];
    const totalItems = identitiesData?.total ?? 0;

    const handleCardClick = (card: string) => {
        if (card === "privilege") setActiveTab("privileged");
        if (card === "mfa") setActiveTab("compliance");
    };

    const handleSync = async () => {
        try {
            await fetch("/api/identity-risk-intelligence/sync", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            refetchSummary();
        } catch { /* ignore */ }
    };

    const isLive = health?.status === "healthy";
    console.log(isLive);
    const tabs = [
        { id: "overview", label: "IAM Overview", icon: LayoutDashboard },
        { id: "directory", label: "Identity Directory", icon: Users },
        { id: "privileged", label: "Privileged Accounts", icon: ShieldAlert },
        { id: "attack-paths", label: "Attack Paths", icon: Network },
        { id: "compliance", label: "Compliance", icon: FileCheck },
        { id: "remediation", label: "Remediation", icon: LifeBuoy },
    ];

    return (
        <div className="space-y-6 pb-20">

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-4"
            >
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text">
                            Identity Risk Intelligence
                        </h1>

                    </div>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                        Managed IAM security experience for cross-cloud identity exposure, privilege sprawl, and lateral movement detection.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2 h-9 text-xs border-border/50 bg-background/50 backdrop-blur-sm" onClick={handleSync}>
                        <RefreshCcw className="h-3.5 w-3.5" /> Force Sync
                    </Button>
                    <Button size="sm" className="h-9 text-xs gap-2 bg-foreground text-background hover:bg-foreground/90 transition-all shadow-lg hover:shadow-primary/20">
                        Export Risk Report
                    </Button>
                </div>
            </motion.div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar border-b border-border/20">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-all relative",
                            activeTab === tab.id
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/10 rounded-md"
                        )}
                    >
                        <tab.icon className={cn("h-3.5 w-3.5", activeTab === tab.id ? "text-primary" : "text-muted-foreground")} />
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
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
                                identities={identities}
                                onCardClick={handleCardClick}
                                onSelectIdentity={setSelectedIdentity}
                            />
                        )}
                        {activeTab === "directory" && (
                            <IdentityManagementView
                                identities={identities}
                                isLoading={isLoading}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                page={page}
                                setPage={setPage}
                                sourceFilter={sourceFilter}
                                setSourceFilter={setSourceFilter}
                                riskFilter={riskFilter}
                                setRiskFilter={setRiskFilter}
                                totalItems={totalItems}
                                onSelectIdentity={setSelectedIdentity}
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
