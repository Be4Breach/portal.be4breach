from typing import List, Dict, Optional
from datetime import datetime, timezone
import logging
from app.models import UnifiedIdentity, IdentitySource

logger = logging.getLogger(__name__)

class IdentityRiskEngine:
    """
    Dynamic Identity Risk Engine to evaluate security posture.
    """
    # Risk factor constants
    FACTOR_NO_MFA = 30
    FACTOR_ADMIN_ROLE = 25
    FACTOR_ORPHANED = 20
    FACTOR_INACTIVE_30D = 10
    FACTOR_INACTIVE_90D = 15
    FACTOR_PRIVILEGE_ESCALATION = 20
    FACTOR_DUPLICATE_IDENTITY = 10
    FACTOR_ROLE_DRIFT = 15
    FACTOR_MFA_INCONSISTENCY = 15
    FACTOR_UNLINKED_SAAS = 15
    FACTOR_EXCESSIVE_GROUPS = 10
    FACTOR_PROD_ACCESS = 20
    FACTOR_PUBLIC_REPO_ADMIN = 15
    FACTOR_STALE_CREDENTIALS = 10
    FACTOR_SHARED_ACCOUNT = 20

    def __init__(self, identities: List[UnifiedIdentity]):
        self.identities = identities
        self.identity_map = self._build_identity_map()

    def _build_identity_map(self) -> Dict[str, List[UnifiedIdentity]]:
        """Maps emails to their identity records across different sources."""
        email_map = {}
        for identity in self.identities:
            if not identity.email:
                continue
            email = identity.email.lower()
            if email not in email_map:
                email_map[email] = []
            email_map[email].append(identity)
        return email_map

    def calculate_risk_score(self, identity: UnifiedIdentity) -> Dict:
        """Calculates risk score for a single identity based on various factors."""
        score = 0
        factors_triggered = []

        # 1. No MFA
        if not identity.mfaEnabled:
            score += self.FACTOR_NO_MFA
            factors_triggered.append("No MFA enabled")

        # 2. Admin role
        if any("admin" in role.lower() for role in identity.roles):
            score += self.FACTOR_ADMIN_ROLE
            factors_triggered.append("Account has administrative privileges")

        # 3. Orphaned Account (No HR linkage)
        email = identity.email.lower() if identity.email else None
        related_identities = self.identity_map.get(email, []) if email else [identity]
        
        has_hr_link = any((i.source == IdentitySource.HR) or (i.source == IdentitySource.DEMO and i.provider == "hr") for i in related_identities)
        if not has_hr_link and identity.source != IdentitySource.HR and not (identity.source == IdentitySource.DEMO and identity.provider == "hr"):
            score += self.FACTOR_ORPHANED
            factors_triggered.append("Orphaned account (No HR linkage detected)")

        # 4. Inactive Status
        if identity.lastLogin:
            now = datetime.now(timezone.utc)
            last_login = identity.lastLogin
            if last_login.tzinfo is None:
                last_login = last_login.replace(tzinfo=timezone.utc)
            days_inactive = (now - last_login).days
            if days_inactive > 90:
                score += self.FACTOR_INACTIVE_90D
                factors_triggered.append(f"Account dormant for {days_inactive} days (Critical)")
            elif days_inactive > 30:
                score += self.FACTOR_INACTIVE_30D
                factors_triggered.append(f"Account inactive for {days_inactive} days")

        # 5. Duplicate Identity Detection
        if len(related_identities) > 1:
            score += self.FACTOR_DUPLICATE_IDENTITY
            factors_triggered.append(f"Duplicate identity found across {len(related_identities)} providers")

        # 6. MFA Inconsistency
        mfa_statuses = {i.mfaEnabled for i in related_identities}
        if len(mfa_statuses) > 1:
            score += self.FACTOR_MFA_INCONSISTENCY
            factors_triggered.append("MFA status is inconsistent across providers")

        # 7. Role Drift Detection
        cloud_sources = {"aws", "azure", "gcp"}
        cloud_identities = [i for i in related_identities if (i.provider if i.source == IdentitySource.DEMO else i.source.value) in cloud_sources]
        if len(cloud_identities) > 1:
            role_counts = [len(i.roles) for i in cloud_identities]
            if max(role_counts) - min(role_counts) > 2:
                score += self.FACTOR_ROLE_DRIFT
                factors_triggered.append("Potential role drift: significant mismatch in role assignments across clouds")

        # 8. SaaS Unlinked Identity
        is_okta = identity.source == IdentitySource.OKTA or (identity.source == IdentitySource.DEMO and identity.provider == "okta")
        has_cloud_link = any((i.provider if i.source == IdentitySource.DEMO else i.source.value) in cloud_sources for i in related_identities)
        if is_okta and not has_cloud_link:
            score += self.FACTOR_UNLINKED_SAAS
            factors_triggered.append("SaaS identity (Okta) not linked to any cloud IAM provider")

        # 9. Privilege Escalation Detection
        if len(identity.roles) >= 10:
            score += self.FACTOR_PRIVILEGE_ESCALATION
            factors_triggered.append("Suspiciously high number of assigned roles")

        # 10. Excessive Group Memberships
        if len(identity.groupMembership) > 5:
            score += self.FACTOR_EXCESSIVE_GROUPS
            factors_triggered.append(f"Excessive group memberships ({len(identity.groupMembership)})")

        # 11. Direct Production Access
        if any("prod" in r.lower() for r in identity.roles) or any("production" in r.lower() for r in identity.roles):
            score += self.FACTOR_PROD_ACCESS
            factors_triggered.append("Direct production environment access detected")

        # 12. Public Repo Admin (Mock logic for GitHub)
        is_github = identity.source == IdentitySource.GITHUB or (identity.source == IdentitySource.DEMO and identity.provider == "github")
        if is_github and any("admin" in r.lower() for r in identity.roles):
            score += self.FACTOR_PUBLIC_REPO_ADMIN
            factors_triggered.append("Administrative rights on potentially public repositories")

        # 13. Credential Age (Mock logic: if inactive for a while, assume stale)
        if identity.lastLogin and (datetime.now(timezone.utc) - (identity.lastLogin.replace(tzinfo=timezone.utc) if identity.lastLogin.tzinfo is None else identity.lastLogin)).days > 90:
            score += self.FACTOR_STALE_CREDENTIALS
            factors_triggered.append("Stale security credentials (>90 days)")

        # 14. Shared Account Detection (Mock logic: common generic names)
        shared_keywords = ["svc", "service", "admin", "test", "demo", "temp", "root"]
        if any(kw in identity.email.lower().split("@")[0] for kw in shared_keywords) and not identity.mfaEnabled:
            score += self.FACTOR_SHARED_ACCOUNT
            factors_triggered.append("Likely shared or service account with interactive login enabled")

        # Final score capped at 100
        total_risk_score = min(score, 100)

        return {
            "identityId": identity.id,
            "totalRiskScore": total_risk_score,
            "riskLevel": self._get_risk_level(total_risk_score),
            "factors": factors_triggered
        }

    def _get_risk_level(self, score: float) -> str:
        if score < 20:
            return "Low"
        elif score < 50:
            return "Medium"
        elif score < 80:
            return "High"
        else:
            return "Critical"

    def process_all(self) -> List[Dict]:
        """Processes all identities and returns their risk profiles."""
        return [self.calculate_risk_score(i) for i in self.identities]
