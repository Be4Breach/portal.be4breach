"""
Identity Analyzer - Remediation Engine
=================================================
Generates prioritized remediation actions based on identity risk factors.
Actions include: role removal, MFA enforcement, dormant account disabling,
privilege scope reduction, toxic combination separation.
"""

from typing import List, Dict, Any
from datetime import datetime, timezone
import logging

from app.models import UnifiedIdentity, IdentitySource

logger = logging.getLogger(__name__)


# ── Remediation Action Templates ──────────────────────────────────────────────

REMEDIATION_TEMPLATES = {
    "enable_mfa": {
        "title": "Enable Multi-Factor Authentication",
        "description": "Enable MFA on all accounts to prevent credential-based attacks",
        "category": "Authentication",
        "auto_remediation_possible": True,
        "estimated_risk_reduction": 25,
    },
    "remove_unused_roles": {
        "title": "Remove Unused / Excessive Roles",
        "description": "Remove roles that exceed operational requirements",
        "category": "Access Control",
        "auto_remediation_possible": True,
        "estimated_risk_reduction": 15,
    },
    "disable_dormant": {
        "title": "Disable Dormant Account",
        "description": "Disable accounts inactive for extended periods",
        "category": "Account Lifecycle",
        "auto_remediation_possible": True,
        "estimated_risk_reduction": 20,
    },
    "reduce_privilege": {
        "title": "Reduce Privilege Scope",
        "description": "Downgrade admin privileges to least-privilege roles",
        "category": "Privilege Management",
        "auto_remediation_possible": False,
        "estimated_risk_reduction": 20,
    },
    "separate_toxic": {
        "title": "Separate Toxic Role Combinations",
        "description": "Split conflicting duties into separate accounts",
        "category": "Governance",
        "auto_remediation_possible": False,
        "estimated_risk_reduction": 15,
    },
    "rotate_credentials": {
        "title": "Rotate Stale Credentials",
        "description": "Force credential rotation for accounts with aged credentials",
        "category": "Credential Management",
        "auto_remediation_possible": True,
        "estimated_risk_reduction": 10,
    },
    "link_identity": {
        "title": "Link Orphaned SaaS Identity",
        "description": "Link unlinked SaaS identity to cloud IAM provider",
        "category": "Identity Governance",
        "auto_remediation_possible": False,
        "estimated_risk_reduction": 10,
    },
    "restrict_cross_cloud": {
        "title": "Restrict Cross-Cloud Admin Access",
        "description": "Apply conditional access policies for cross-cloud admin operations",
        "category": "Zero Trust",
        "auto_remediation_possible": False,
        "estimated_risk_reduction": 15,
    },
}

TOXIC_ROLE_SETS = [
    ({"admin", "superadmin", "owner", "globaladmin", "root"}, {"billing", "finance", "payment"}),
    ({"admin", "superadmin", "owner"}, {"auditor", "compliance", "security"}),
    ({"developer", "engineer"}, {"deployer", "release", "production"}),
    ({"dbadmin", "dba"}, {"developer", "engineer"}),
]


class RemediationEngine:
    """Generates prioritized remediation actions for identities."""

    def __init__(self, identities: List[UnifiedIdentity]):
        self.identities = identities

    def _get_priority(self, risk_score: float, is_admin: bool) -> str:
        if risk_score >= 80 or (is_admin and risk_score >= 50):
            return "critical"
        if risk_score >= 60:
            return "high"
        if risk_score >= 30:
            return "medium"
        return "low"

    def generate_for_identity(self, identity: UnifiedIdentity) -> List[Dict[str, Any]]:
        """Generate remediation actions for a single identity."""
        actions: List[Dict[str, Any]] = []
        roles_lower = {r.lower() for r in identity.roles}
        is_admin = any(
            kw in r for r in roles_lower
            for kw in ("admin", "owner", "superadmin", "root", "globaladmin")
        )

        # 1. MFA not enabled
        if not identity.mfaEnabled:
            tmpl = REMEDIATION_TEMPLATES["enable_mfa"]
            actions.append({
                **tmpl,
                "identityId": identity.id,
                "email": identity.email,
                "provider": identity.source.value,
                "priority_level": "critical" if is_admin else "high",
                "details": f"Enable MFA on {identity.source.value.upper()} account for {identity.email}",
            })

        # 2. Excessive roles
        if len(identity.roles) > 8:
            tmpl = REMEDIATION_TEMPLATES["remove_unused_roles"]
            excess = identity.roles[5:]  # keep first 5 as essential
            actions.append({
                **tmpl,
                "identityId": identity.id,
                "email": identity.email,
                "provider": identity.source.value,
                "priority_level": self._get_priority(identity.riskScore, is_admin),
                "details": f"Review and remove {len(excess)} potentially excessive roles: {', '.join(excess[:5])}",
                "roles_to_review": excess,
            })

        # 3. Dormant account
        if identity.lastLogin:
            now = datetime.now(timezone.utc)
            last = identity.lastLogin
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            days_inactive = (now - last).days
            if days_inactive > 90:
                tmpl = REMEDIATION_TEMPLATES["disable_dormant"]
                actions.append({
                    **tmpl,
                    "identityId": identity.id,
                    "email": identity.email,
                    "provider": identity.source.value,
                    "priority_level": "high" if is_admin else "medium",
                    "details": f"Account inactive for {days_inactive} days. Disable or verify with user.",
                    "days_inactive": days_inactive,
                })

        # 4. Admin privilege reduction
        if is_admin and len(identity.roles) > 3:
            tmpl = REMEDIATION_TEMPLATES["reduce_privilege"]
            actions.append({
                **tmpl,
                "identityId": identity.id,
                "email": identity.email,
                "provider": identity.source.value,
                "priority_level": self._get_priority(identity.riskScore, True),
                "details": f"Admin account has {len(identity.roles)} roles. Evaluate if full admin is required.",
            })

        # 5. Toxic role combinations
        for set_a, set_b in TOXIC_ROLE_SETS:
            has_a = any(any(kw in r for kw in set_a) for r in roles_lower)
            has_b = any(any(kw in r for kw in set_b) for r in roles_lower)
            if has_a and has_b:
                tmpl = REMEDIATION_TEMPLATES["separate_toxic"]
                actions.append({
                    **tmpl,
                    "identityId": identity.id,
                    "email": identity.email,
                    "provider": identity.source.value,
                    "priority_level": "high",
                    "details": "Toxic combination detected: Conflict found between administrative and sensitive business functions.",
                })
                break

        # 6. Orphaned SaaS identity
        cloud_sources = {IdentitySource.AWS, IdentitySource.AZURE, IdentitySource.GCP}
        if identity.source == IdentitySource.OKTA:
            has_cloud = any(
                i.source in cloud_sources
                for i in self.identities
                if i.email and identity.email and i.email.lower() == identity.email.lower()
            )
            if not has_cloud:
                tmpl = REMEDIATION_TEMPLATES["link_identity"]
                actions.append({
                    **tmpl,
                    "identityId": identity.id,
                    "email": identity.email,
                    "provider": identity.source.value,
                    "priority_level": "medium",
                    "details": f"Okta identity {identity.email} not linked to any cloud IAM provider.",
                })

        # 7. Cross-cloud admin
        cloud_admin_count = sum(
            1 for i in self.identities
            if i.email and identity.email
            and i.email.lower() == identity.email.lower()
            and i.source in cloud_sources
            and any("admin" in r.lower() for r in i.roles)
        )
        if cloud_admin_count > 1:
            tmpl = REMEDIATION_TEMPLATES["restrict_cross_cloud"]
            actions.append({
                **tmpl,
                "identityId": identity.id,
                "email": identity.email,
                "provider": identity.source.value,
                "priority_level": "high",
                "details": f"Admin access across {cloud_admin_count} cloud providers. Apply conditional access.",
            })

        # Sort by priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        actions.sort(key=lambda a: priority_order.get(a.get("priority_level", "low"), 3))

        return actions

    def generate_all(self) -> Dict[str, Any]:
        """Generate remediation actions for all identities."""
        all_actions: List[Dict[str, Any]] = []
        identity_actions: Dict[str, List[Dict[str, Any]]] = {}

        for identity in self.identities:
            actions = self.generate_for_identity(identity)
            if actions:
                identity_actions[identity.id] = actions
                all_actions.extend(actions)

        # Sort globally by priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        all_actions.sort(key=lambda a: priority_order.get(a.get("priority_level", "low"), 3))

        # Category breakdown
        category_counts: Dict[str, int] = {}
        priority_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        total_risk_reduction = 0

        for action in all_actions:
            cat = action.get("category", "Other")
            category_counts[cat] = category_counts.get(cat, 0) + 1
            prio = action.get("priority_level", "low")
            priority_counts[prio] = priority_counts.get(prio, 0) + 1
            total_risk_reduction += action.get("estimated_risk_reduction", 0)

        auto_count = sum(1 for a in all_actions if a.get("auto_remediation_possible", False))

        return {
            "total_actions": len(all_actions),
            "identities_affected": len(identity_actions),
            "priority_breakdown": priority_counts,
            "category_breakdown": category_counts,
            "auto_remediable_count": auto_count,
            "manual_count": len(all_actions) - auto_count,
            "estimated_total_risk_reduction": min(total_risk_reduction, 100),
            "actions": all_actions[:50],  # Cap at 50 for API response
        }
