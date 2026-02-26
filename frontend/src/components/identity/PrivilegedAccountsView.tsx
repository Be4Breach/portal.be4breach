import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, Globe, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import IdentityTable from "./IdentityTable";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { Identity } from "../../types/identity";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

interface IdentitiesResponse {
    items: Identity[];
    total: number;
    page: number;
    limit: number;
}

const PrivilegedAccountsView = ({ onSelectIdentity }: { onSelectIdentity: (id: Identity) => void }) => {
    const { token } = useAuth();

    function anyAdminRole(roles: string[]) {
        return roles.some(r => r.toLowerCase().includes("admin") || r.toLowerCase().includes("owner") || r.toLowerCase().includes("root"));
    }

    const { data: identitiesData, isLoading } = useQuery<IdentitiesResponse>({
        queryKey: ["privileged-identities"],
        queryFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/identities?limit=100`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Failed to fetch privileged identities");
            const data = await resp.json() as IdentitiesResponse;
            // Filter to only privileged accounts for this view
            return {
                ...data,
                items: data.items.filter((i) =>
                    i.privilegeTier === "critical" ||
                    i.privilegeTier === "high" ||
                    anyAdminRole(i.roles)
                )
            };
        },
        enabled: !!token
    });

    const identities = identitiesData?.items ?? [];

    const stats = {
        criticalAdmins: identities.filter(id => id.privilegeTier === "critical").length,
        crossCloud: identities.filter(id => id.cloudAccounts?.length > 1).length,
        superAdmins: identities.filter(id => id.roles?.some(r => r.toLowerCase().includes("super") || r.toLowerCase().includes("owner"))).length
    };

    const cards = [
        { title: "Critical Admins", value: stats.criticalAdmins, icon: ShieldAlert, color: "text-red-500", desc: "Highest risk privileged accounts" },
        { title: "Cross-Cloud Admins", value: stats.crossCloud, icon: Globe, color: "text-blue-500", desc: "Admins with multi-provider access" },
        { title: "SaaS Super Admins", value: stats.superAdmins, icon: Zap, color: "text-purple-500", desc: "Highest tier application control" },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((c, i) => (
                    <Card key={i} className="border border-border/50 bg-card/60 backdrop-blur-md shadow-lg rounded-xl overflow-hidden hover:border-primary/20 transition-all group">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{c.title}</CardTitle>
                            <c.icon className={cn("h-4 w-4", c.color)} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black">{c.value}</div>
                            <p className="text-[9px] font-medium text-muted-foreground/60 uppercase mt-1 tracking-tighter">{c.desc}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="border border-border/50 rounded-xl overflow-hidden bg-card/60 backdrop-blur-md shadow-lg">
                <div className="px-6 py-4 border-b border-border/10 bg-muted/20">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Privileged Identity Directory</h3>
                </div>
                <IdentityTable
                    identities={identities}
                    isLoading={isLoading}
                    totalItems={identities.length}
                    onSelectIdentity={onSelectIdentity}
                    searchTerm=""
                    setSearchTerm={() => { }}
                    page={1}
                    setPage={() => { }}
                    sourceFilter="all"
                    setSourceFilter={() => { }}
                    riskFilter="all"
                    setRiskFilter={() => { }}
                />
            </div>
        </div>
    );
};

export default PrivilegedAccountsView;
