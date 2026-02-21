import { useQuery } from "@tanstack/react-query";
import { Crown, Terminal, Network } from "lucide-react";
import IdentityTable from "./IdentityTable";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_MODE } from "@/api/demoConfig";
import { MOCK_IDENTITIES } from "@/mocks/identityMockData";

const PrivilegedAccountsView = ({ onSelectIdentity }: { onSelectIdentity: (id: any) => void }) => {
    const { token } = useAuth();
    // We reuse the identities endpoint but filter for privileged tiers
    const { data: identitiesData, isLoading } = useQuery({
        queryKey: ["privileged-identities"],
        queryFn: async () => {
            if (DEMO_MODE) {
                const filtered = MOCK_IDENTITIES.filter((i: any) =>
                    i.privilegeTier === "Critical" ||
                    i.privilegeTier === "High" ||
                    anyAdminRole(i.roles)
                );
                return { items: filtered, total: filtered.length };
            }
            try {
                const resp = await fetch("/api/identity-risk-intelligence/identities?limit=100", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!resp.ok) throw new Error("Failed");
                const data = await resp.json();
                return {
                    ...data,
                    items: data.items.filter((i: any) =>
                        i.privilegeTier === "Critical" ||
                        i.privilegeTier === "High" ||
                        anyAdminRole(i.roles)
                    )
                };
            } catch (err) {
                console.warn("API Error, falling back to mock:", err);
                const filtered = MOCK_IDENTITIES.filter((i: any) =>
                    i.privilegeTier === "Critical" ||
                    i.privilegeTier === "High" ||
                    anyAdminRole(i.roles)
                );
                return { items: filtered, total: filtered.length };
            }
        }
    });

    function anyAdminRole(roles: string[]) {
        return roles.some(r => r.toLowerCase().includes("admin") || r.toLowerCase().includes("owner") || r.toLowerCase().includes("root"));
    }

    const identities = identitiesData?.items ?? [];

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <div className="border border-border/50 rounded-lg p-5 bg-card flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-red-400/10 flex items-center justify-center">
                        <Crown className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">Critical Admins</p>
                        <p className="text-xl font-bold">{identities.filter((i: any) => i.privilegeTier === "Critical").length}</p>
                    </div>
                </div>
                <div className="border border-border/50 rounded-lg p-5 bg-card flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-orange-400/10 flex items-center justify-center">
                        <Network className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">Cross-Cloud Admins</p>
                        <p className="text-xl font-bold">{identities.filter((i: any) => i.cloudAccounts?.length > 1).length}</p>
                    </div>
                </div>
                <div className="border border-border/50 rounded-lg p-5 bg-card flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-400/10 flex items-center justify-center">
                        <Terminal className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">SaaS Super Admins</p>
                        <p className="text-xl font-bold">{identities.filter((i: any) => i.source === "okta" && anyAdminRole(i.roles)).length}</p>
                    </div>
                </div>
            </div>

            <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
                <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
                    <h3 className="font-semibold text-sm">Privileged Identity Directory</h3>
                </div>
                <IdentityTable
                    identities={identities}
                    isLoading={isLoading}
                    searchTerm=""
                    setSearchTerm={() => { }}
                    page={1}
                    setPage={() => { }}
                    sourceFilter="all"
                    setSourceFilter={() => { }}
                    riskFilter="all"
                    setRiskFilter={() => { }}
                    totalItems={identities.length}
                    onSelectIdentity={onSelectIdentity}
                />
            </div>
        </div>
    );
};

export default PrivilegedAccountsView;
