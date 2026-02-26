export interface Identity {
    id: string;
    email: string;
    source: string;
    provider?: string;
    roles: string[];
    mfaEnabled: boolean;
    isActive: boolean;
    riskScore: number;
    privilegeTier: string;
    exposureLevel: number;
    attackPathCount: number;
    blastRadius: number;
    cloudAccounts: string[];
    lastLogin: string | null;
    linkedAccounts: string[];
}

export interface SummaryData {
    total_identities: number;
    risky_users: number;
    critical_alerts: number;
    orphaned_accounts: number;
    mfa_failures: number;
    privilege_escalations: number;
    last_sync: string;
    global_risk_score: { score: number; label: string; breakdown: Record<string, number> };
    breach_probability: { probability: number; totalPaths: number };
    mfa_coverage: { coverage: number };
    privileged_ratio: number;
    admin_count: number;
}

export interface DashboardAggregation {
    total_identities: number;
    privileged_count: number;
    non_privileged_count: number;
    high_risk_count: number;
    admin_count: number;
    standard_count: number;
    iam_owners: number;
    repo_admins: number;
    provider_distribution: Record<string, number>;
    risk_distribution: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    sync_history: Array<{
        date: string;
        provider: string;
        avg_risk: number;
        total_synced: number;
        privileged_count: number;
    }>;
    identity_list: Partial<Identity>[];
}

export interface ComplianceData {
    compliance_score: number;
    severity_breakdown: Record<string, number>;
    policy_stats: Record<string, {
        name: string;
        category: string;
        identities_affected: number;
        violations: number;
    }>;
    top_violations: Array<{
        severity: string;
        email: string;
        message: string;
    }>;
}

export interface GraphData {
    nodes: Array<{
        id: string;
        email: string;
        source: string;
        riskScore: number;
    }>;
    edges: Array<{
        source: string;
        target: string;
        relationship: string;
    }>;
}

export interface IdentityDetail extends Identity {
    riskFactors: string[];
    connectedIdentities: Array<Partial<Identity>>;
    blastRadiusData: {
        blastRadius: number;
        nodesAffected: number;
        highRiskAffected: number;
    };
    attackPaths: Array<Array<{
        id: string;
        email: string;
        relationship: string;
    }>>;
    lateralMovement: Array<{
        to: { email: string; source: string };
        path: string[];
    }>;
    remediations: Array<{
        title: string;
        details: string;
        risk_reduction_score: number;
        priority_level?: string;
    }>;
}
