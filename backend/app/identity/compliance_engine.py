"""
Identity Analyzer - Compliance Engine
================================================
Checks identities against compliance frameworks:
- Least Privilege
- Zero Trust
- MFA Compliance
- Dormant Account Policy
- Separation of Duties
"""

from typing import List, Dict, Any
from datetime import datetime, timezone
import logging

from app.models import UnifiedIdentity, IdentitySource

logger = logging.getLogger(__name__)

# ── Compliance Policy Definitions ─────────────────────────────────────────────

COMPLIANCE_POLICIES = {
    "least_privilege": {
        "name": "Least Privilege",
        "description": "Users should only have the minimum permissions required",
        "category": "Access Control",
        "weight": 25,
    },
    "zero_trust": {
        "name": "Zero Trust Verification",
        "description": "All access must be verified regardless of network location",
        "category": "Zero Trust",
        "weight": 20,
    },
    "mfa_enforcement": {
        "name": "MFA Enforcement",
        "description": "All accounts must have multi-factor authentication enabled",
        "category": "Authentication",
        "weight": 25,
    },
    "dormant_account": {
        "name": "Dormant Account Policy",
        "description": "Accounts inactive for >30 days must be reviewed or disabled",
        "category": "Account Lifecycle",
        "weight": 15,
    },
    "separation_of_duties": {
        "name": "Separation of Duties",
        "description": "Critical functions must be divided among different people",
        "category": "Governance",
        "weight": 15,
    },
}

# Toxic role combinations that violate Separation of Duties
TOXIC_COMBINATIONS = [
    ({"admin", "superadmin", "owner", "globaladmin", "root"}, {"billing", "finance", "payment"}),
    ({"admin", "superadmin", "owner"}, {"auditor", "compliance", "security"}),
    ({"developer", "engineer"}, {"deployer", "release", "production"}),
    ({"dbadmin", "dba"}, {"developer", "engineer"}),
]


class ComplianceEngine:
    """Evaluates identity compliance against organizational policies."""

    def __init__(self, identities: List[UnifiedIdentity]):
        self.identities = identities
        self._violations_cache: Dict[str, List[Dict[str, Any]]] = {}

    # ── Per-Identity Compliance ───────────────────────────────────────────────

    def check_identity_compliance(self, identity: UnifiedIdentity) -> Dict[str, Any]:
        """Check a single identity against all compliance policies."""
        violations: List[Dict[str, Any]] = []
        passed: List[str] = []
        roles_lower = {r.lower() for r in identity.roles}

        # 1. Least Privilege
        admin_roles = {r for r in roles_lower if any(
            kw in r for kw in ("admin", "owner", "superadmin", "root", "globaladmin")
        )}
        if len(identity.roles) > 8 or len(admin_roles) > 2:
            violations.append({
                "policy": "least_privilege",
                "severity": "high",
                "message": f"User has {len(identity.roles)} roles including {len(admin_roles)} admin roles — exceeds least privilege threshold",
                "remediation": "Audit and remove unnecessary roles. Limit admin privileges to specific scopes.",
            })
        elif admin_roles and not identity.mfaEnabled:
            violations.append({
                "policy": "least_privilege",
                "severity": "critical",
                "message": "Admin account without MFA violates least privilege + authentication policy",
                "remediation": "Immediately enable MFA and reduce privilege scope.",
            })
        else:
            passed.append("least_privilege")

        # 2. Zero Trust
        cloud_sources = {"aws", "azure", "gcp"}
        is_cross_cloud = sum(
            1 for i in self.identities
            if i.email and identity.email and
            i.email.lower() == identity.email.lower() and
            (i.provider if i.source == IdentitySource.DEMO else i.source.value) in cloud_sources
        ) > 1
        if is_cross_cloud and not identity.mfaEnabled:
            violations.append({
                "policy": "zero_trust",
                "severity": "critical",
                "message": "Cross-cloud identity without MFA violates Zero Trust policy",
                "remediation": "Enable MFA on all linked cloud accounts and implement conditional access policies.",
            })
        elif is_cross_cloud and admin_roles:
            violations.append({
                "policy": "zero_trust",
                "severity": "high",
                "message": "Cross-cloud admin access increases attack surface — requires enhanced verification",
                "remediation": "Implement step-up authentication for cross-cloud admin operations.",
            })
        else:
            passed.append("zero_trust")

        # 3. MFA Enforcement
        if not identity.mfaEnabled:
            sev = "critical" if admin_roles else "high"
            violations.append({
                "policy": "mfa_enforcement",
                "severity": sev,
                "message": f"MFA not enabled on {identity.source.value.upper()} account",
                "remediation": "Enable MFA immediately. Use hardware keys for admin accounts, authenticator apps for standard users.",
            })
        else:
            passed.append("mfa_enforcement")

        # 4. Dormant Account
        if identity.lastLogin:
            now = datetime.now(timezone.utc)
            last = identity.lastLogin
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            days_inactive = (now - last).days
            if days_inactive > 90:
                violations.append({
                    "policy": "dormant_account",
                    "severity": "high",
                    "message": f"Account inactive for {days_inactive} days — exceeds 90-day dormancy policy",
                    "remediation": "Disable the account and reassign any active responsibilities.",
                })
            elif days_inactive > 30:
                violations.append({
                    "policy": "dormant_account",
                    "severity": "medium",
                    "message": f"Account inactive for {days_inactive} days — approaching dormancy threshold",
                    "remediation": "Review account necessity. Contact user to verify continued access requirement.",
                })
            else:
                passed.append("dormant_account")
        elif not identity.isActive:
            violations.append({
                "policy": "dormant_account",
                "severity": "medium",
                "message": "Inactive account with no recorded last login",
                "remediation": "Verify account status and disable if no longer needed.",
            })
        else:
            passed.append("dormant_account")

        # 5. Separation of Duties
        for set_a, set_b in TOXIC_COMBINATIONS:
            has_a = any(any(kw in r for kw in set_a) for r in roles_lower)
            has_b = any(any(kw in r for kw in set_b) for r in roles_lower)
            if has_a and has_b:
                violations.append({
                    "policy": "separation_of_duties",
                    "severity": "high",
                    "message": "Toxic role combination detected: Multiple conflicting privileges assigned to same identity",
                    "remediation": "Separate conflicting roles into different accounts or request formal exception with compensating controls.",
                })
                break
        else:
            passed.append("separation_of_duties")

        # Calculate per-identity compliance score
        total_weight = sum(p["weight"] for p in COMPLIANCE_POLICIES.values())
        violated_weight = sum(
            COMPLIANCE_POLICIES[v["policy"]]["weight"]
            for v in violations
            if v["policy"] in COMPLIANCE_POLICIES
        )
        # Deduplicate: only count each policy once
        violated_policies = set(v["policy"] for v in violations)
        unique_violated_weight = sum(
            COMPLIANCE_POLICIES[p]["weight"] for p in violated_policies
        )
        score = max(0, round((1 - unique_violated_weight / total_weight) * 100))

        return {
            "identityId": identity.id,
            "email": identity.email,
            "compliance_score": score,
            "violations": violations,
            "passed_policies": passed,
            "total_checks": len(COMPLIANCE_POLICIES),
            "violations_count": len(violations),
        }

    # ── Global Compliance Report ──────────────────────────────────────────────

    def get_global_compliance(self) -> Dict[str, Any]:
        """Generate organization-wide compliance report."""
        all_results = [self.check_identity_compliance(i) for i in self.identities]

        total_violations = []
        policy_stats: Dict[str, Dict[str, int]] = {}
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        category_scores: Dict[str, List[float]] = {}

        for result in all_results:
            for v in result["violations"]:
                total_violations.append({
                    **v,
                    "identityId": result["identityId"],
                    "email": result["email"],
                })
                pol = v["policy"]
                if pol not in policy_stats:
                    policy_stats[pol] = {"violations": 0, "identities_affected": 0}
                policy_stats[pol]["violations"] += 1
                severity_counts[v.get("severity", "medium")] += 1

            for pol in COMPLIANCE_POLICIES:
                if pol not in policy_stats:
                    policy_stats[pol] = {"violations": 0, "identities_affected": 0}

        # Count unique identities per policy
        for pol in policy_stats:
            affected = set()
            for v in total_violations:
                if v["policy"] == pol:
                    affected.add(v["identityId"])
            policy_stats[pol]["identities_affected"] = len(affected)

        # Category breakdown
        for pol_key, pol_info in COMPLIANCE_POLICIES.items():
            cat = pol_info["category"]
            if cat not in category_scores:
                category_scores[cat] = []
            affected = policy_stats.get(pol_key, {}).get("identities_affected", 0)
            cat_score = max(0, 100 - (affected / max(len(self.identities), 1)) * 100)
            category_scores[cat].append(cat_score)

        category_averages = {
            cat: round(sum(scores) / len(scores))
            for cat, scores in category_scores.items()
        }

        # Global score
        identity_scores = [r["compliance_score"] for r in all_results]
        global_score = round(sum(identity_scores) / max(len(identity_scores), 1))

        # Top violations
        top_violations = sorted(total_violations, key=lambda x: {
            "critical": 0, "high": 1, "medium": 2, "low": 3
        }.get(x.get("severity", "medium"), 2))[:20]

        return {
            "compliance_score": global_score,
            "total_identities": len(self.identities),
            "total_violations": len(total_violations),
            "severity_breakdown": severity_counts,
            "policy_stats": {
                k: {
                    **v,
                    "name": COMPLIANCE_POLICIES[k]["name"],
                    "category": COMPLIANCE_POLICIES[k]["category"],
                    "description": COMPLIANCE_POLICIES[k]["description"],
                }
                for k, v in policy_stats.items()
            },
            "category_scores": category_averages,
            "top_violations": top_violations,
            "identity_results": all_results,
        }
