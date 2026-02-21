import IdentityTable from "./IdentityTable";

interface IdentityManagementViewProps {
    identities: any[];
    isLoading: boolean;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    page: number;
    setPage: (page: any) => void;
    sourceFilter: string;
    setSourceFilter: (filter: string) => void;
    riskFilter: string;
    setRiskFilter: (filter: string) => void;
    totalItems: number;
    onSelectIdentity: (identity: any) => void;
}

const IdentityManagementView = (props: IdentityManagementViewProps) => {
    return (
        <div className="space-y-6">
            <IdentityTable {...props} />
        </div>
    );
};

export default IdentityManagementView;
