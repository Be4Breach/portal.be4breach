import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConnectorCard } from "./ConnectorCard";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export const IAMConnectors = () => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const fetchStatus = async (provider: string) => {
        const route = provider === 'gcp' ? '/api/integrations/gcp/status' :
            provider === 'github' ? '/api/github/status' :
                `/api/identity-risk-intelligence/providers/${provider}/status`;

        const resp = await fetch(`${BACKEND_URL}${route}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) return { connected: false };
        return resp.json();
    };

    const { data: gcpStatus, isLoading: gcpLoading } = useQuery({
        queryKey: ["gcp-status"],
        queryFn: () => fetchStatus('gcp'),
        enabled: !!token,
        refetchInterval: 30000,
    });

    const { data: githubStatus, isLoading: githubLoading } = useQuery({
        queryKey: ["github-iam-status"],
        queryFn: () => fetchStatus('github'),
        enabled: !!token,
        refetchInterval: 30000,
    });

    const { data: awsStatus, isLoading: awsLoading } = useQuery({
        queryKey: ["aws-status"],
        queryFn: () => fetchStatus('aws'),
        enabled: !!token,
        refetchInterval: 30000,
    });

    const { data: azureStatus, isLoading: azureLoading } = useQuery({
        queryKey: ["azure-status"],
        queryFn: () => fetchStatus('azure'),
        enabled: !!token,
        refetchInterval: 30000,
    });

    const { data: gitlabStatus, isLoading: gitlabLoading } = useQuery({
        queryKey: ["gitlab-status"],
        queryFn: () => fetchStatus('gitlab'),
        enabled: !!token,
        refetchInterval: 30000,
    });

    const { data: oktaStatus, isLoading: oktaLoading } = useQuery({
        queryKey: ["okta-status"],
        queryFn: () => fetchStatus('okta'),
        enabled: !!token,
        refetchInterval: 30000,
    });

    const gcpSync = useMutation({
        mutationFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/integrations/gcp/sync`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({ detail: "Sync failed" }));
                throw new Error(errorData.detail || "Sync failed");
            }
            return resp.json();
        },
        onSuccess: () => {
            toast.success("GCP Synchronization Success", {
                icon: '🚀',
                style: { borderRadius: '10px', background: '#333', color: '#fff' }
            });
            queryClient.invalidateQueries({ queryKey: ["gcp-status"] });
            queryClient.invalidateQueries({ queryKey: ["identities"] });
            queryClient.invalidateQueries({ queryKey: ["identity-summary"] });
        }
    });

    const githubSync = useMutation({
        mutationFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/github/sync`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({ detail: "Sync failed" }));
                throw new Error(errorData.detail || "Sync failed");
            }
            return resp.json();
        },
        onSuccess: () => {
            toast.success("GitHub Synchronization Success", {
                icon: '🚀',
                style: { borderRadius: '10px', background: '#333', color: '#fff' }
            });
            queryClient.invalidateQueries({ queryKey: ["github-iam-status"] });
            queryClient.invalidateQueries({ queryKey: ["identities"] });
            queryClient.invalidateQueries({ queryKey: ["identity-summary"] });
        }
    });

    const genericSync = useMutation({
        mutationFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/sync`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({ detail: "Sync failed" }));
                throw new Error(errorData.detail || "Sync failed");
            }
            return resp.json();
        },
        onSuccess: () => {
            toast.success("Identity Sync Success", {
                icon: '🚀',
                style: { borderRadius: '10px', background: '#333', color: '#fff' }
            });
            queryClient.invalidateQueries({ queryKey: ["identities"] });
            queryClient.invalidateQueries({ queryKey: ["identity-summary"] });
        }
    });

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between px-1">
                <div className="space-y-1">
                    <h2 className="text-lg font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">Identity Governance</h2>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-[0.1em] opacity-80">Synchronized Cloud IAM Directory</p>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 backdrop-blur-md shadow-sm">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/90">LIVE FEED</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ConnectorCard
                    title="Google Cloud Platform"
                    status={gcpStatus?.connected ? 'connected' : (gcpStatus?.error ? 'error' : 'disconnected')}
                    projectId={gcpStatus?.project_id}
                    users={gcpStatus?.total_users}
                    serviceAccounts={gcpStatus?.service_accounts}
                    privilegedAccounts={gcpStatus?.privileged_accounts}
                    lastSync={gcpStatus?.last_sync}
                    onSync={() => gcpSync.mutate()}
                    isLoading={gcpSync.isPending || gcpLoading}
                />

                <ConnectorCard
                    title="GitHub Integration"
                    status={githubStatus?.connected ? 'connected' : (githubStatus?.error ? 'error' : 'disconnected')}
                    projectId={githubStatus?.project_id ? `@${githubStatus.project_id}` : undefined}
                    users={githubStatus?.total_users}
                    serviceAccounts={githubStatus?.service_accounts}
                    privilegedAccounts={githubStatus?.privileged_accounts}
                    lastSync={githubStatus?.last_sync}
                    onSync={() => githubSync.mutate()}
                    isLoading={githubSync.isPending || githubLoading}
                />

                <ConnectorCard
                    title="Amazon Web Services"
                    status={awsStatus?.connected ? (awsStatus.status === 'demo' ? 'connected' : 'connected') : 'disconnected'}
                    projectId={awsStatus?.project_id}
                    users={awsStatus?.total_users}
                    serviceAccounts={awsStatus?.service_accounts}
                    privilegedAccounts={awsStatus?.privileged_accounts}
                    lastSync={awsStatus?.last_sync}
                    onSync={() => genericSync.mutate()}
                    isLoading={genericSync.isPending || awsLoading}
                />

                <ConnectorCard
                    title="Microsoft Azure"
                    status={azureStatus?.connected ? 'connected' : 'disconnected'}
                    projectId={azureStatus?.project_id}
                    users={azureStatus?.total_users}
                    serviceAccounts={azureStatus?.service_accounts}
                    privilegedAccounts={azureStatus?.privileged_accounts}
                    lastSync={azureStatus?.last_sync}
                    onSync={() => genericSync.mutate()}
                    isLoading={genericSync.isPending || azureLoading}
                />

                <ConnectorCard
                    title="GitLab Source Control"
                    status={gitlabStatus?.connected ? 'connected' : 'disconnected'}
                    projectId={gitlabStatus?.project_id}
                    users={gitlabStatus?.total_users}
                    serviceAccounts={gitlabStatus?.service_accounts}
                    privilegedAccounts={gitlabStatus?.privileged_accounts}
                    lastSync={gitlabStatus?.last_sync}
                    onSync={() => genericSync.mutate()}
                    isLoading={genericSync.isPending || gitlabLoading}
                />

                <ConnectorCard
                    title="Okta Identity"
                    status={oktaStatus?.connected ? 'connected' : 'disconnected'}
                    projectId={oktaStatus?.project_id}
                    users={oktaStatus?.total_users}
                    serviceAccounts={oktaStatus?.service_accounts}
                    privilegedAccounts={oktaStatus?.privileged_accounts}
                    lastSync={oktaStatus?.last_sync}
                    onSync={() => genericSync.mutate()}
                    isLoading={genericSync.isPending || oktaLoading}
                />
            </div>
        </div>
    );
};
