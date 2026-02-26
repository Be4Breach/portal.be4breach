import IdentityTable from "./IdentityTable";
import type { Identity } from "../../types/identity";

interface IdentityManagementViewProps {
    identities: Identity[];
    isLoading: boolean;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    page: number;
    setPage: (fn: (p: number) => number) => void;
    sourceFilter: string;
    setSourceFilter: (filter: string) => void;
    riskFilter: string;
    setRiskFilter: (filter: string) => void;
    totalItems: number;
    onSelectIdentity: (identity: Identity) => void;
}

const IdentityManagementView = (props: IdentityManagementViewProps) => {
    return (
        <div className="space-y-6">
            <IdentityTable {...props} />
        </div>
    );
};

export default IdentityManagementView;
