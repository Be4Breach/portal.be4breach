import logging
import os
from typing import List, Dict, Any
from app.identity.connectors.base import BaseConnector
from app.models import UnifiedIdentity, IdentitySource, PrivilegeTier
from datetime import datetime

logger = logging.getLogger(__name__)

class GCPConnector(BaseConnector):
    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(IdentitySource.GCP, credentials)

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        """Fetch project IAM policies from GCP."""
        from google.cloud import resourcemanager_v3
        from google.cloud import iam_admin_v1
        from google.oauth2 import service_account
        
        project_id = os.getenv("GCP_PROJECT_ID")
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        
        if not project_id or not creds_path:
            logger.error("GCP sync failed: GCP_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS missing.")
            return []

        try:
            creds = service_account.Credentials.from_service_account_file(creds_path)
            
            # 1. Fetch IAM Policy
            async_crm_client = resourcemanager_v3.ProjectsAsyncClient(credentials=creds)
            policy = await async_crm_client.get_iam_policy(resource=f"projects/{project_id}")
            
            # 2. Fetch SA Keys status for risk enrichment
            iam_client = iam_admin_v1.IAMClient(credentials=creds)
            sa_keys_status = {}
            try:
                # Iterate over SAs in the project
                sas = await iam_client.list_service_accounts(name=f"projects/{project_id}")
                for sa in sas:
                    email = sa.email
                    has_active = False
                    # List keys for this specific SA
                    keys = await iam_client.list_service_account_keys(name=f"projects/{project_id}/serviceAccounts/{email}")
                    for key in keys.keys:
                        # Only count user-managed keys, not system keys
                        if key.key_type == iam_admin_v1.ListServiceAccountKeysRequest.KeyType.USER_MANAGED and not key.disabled:
                            has_active = True
                            break
                    sa_keys_status[email] = has_active
            except Exception as e:
                logger.warning(f"Failed to fetch SA keys during GCP sync: {e}")

            # 3. Process Bindings (Normalization)
            identities_map = {}
            for binding in policy.bindings:
                role = binding.role
                for member in binding.members:
                    if member.startswith("user:"):
                        email = member.replace("user:", "")
                        m_type = "user"
                    elif member.startswith("serviceAccount:"):
                        email = member.replace("serviceAccount:", "")
                        m_type = "serviceAccount"
                    else:
                        continue
                    
                    if email not in identities_map:
                        identities_map[email] = {
                            "roles": [], 
                            "type": m_type, 
                            "has_active_keys": sa_keys_status.get(email, False)
                        }
                    identities_map[email]["roles"].append(role)
            
            # 4. Mandatory Identity Check as per requirement
            required_identities = ["divyanshpra2301@gmail.com", "divyanshparashar11@gmail.com"]
            for req_email in required_identities:
                if req_email not in identities_map:
                    logger.error(f"Identity not present in GCP IAM: {req_email}")

            return [{"email": k, **v} for k, v in identities_map.items()]
        except Exception as e:
            logger.error(f"GCP API error during sync: {str(e)}")
            raise e

    def normalize(self, raw_data: Dict[str, Any]) -> UnifiedIdentity:
        """Normalize GCP user data into UnifiedIdentity."""
        email = raw_data["email"]
        roles = raw_data["roles"]
        is_sa = raw_data["type"] == "serviceAccount"
        has_active_keys = raw_data["has_active_keys"]
        
        PRIVILEGED_ROLES = [
            "roles/owner", 
            "roles/editor",
            "roles/iam.securityAdmin",
            "roles/resourcemanager.projectIamAdmin",
        ]
        
        risk_score = 10.0
        is_high_risk = False
        roles_lower = [r.lower() for r in roles]
        
        # Risk factors
        if "roles/owner" in roles_lower:
            risk_score += 80
            is_high_risk = True
        elif "roles/editor" in roles_lower:
            risk_score += 60
            is_high_risk = True
        elif any(r.lower() in ["roles/iam.securityadmin", "roles/resourcemanager.projectiamadmin"] for r in roles_lower):
            risk_score += 50
            is_high_risk = True
            
        if is_sa and has_active_keys:
            risk_score += 40
            is_high_risk = True
            
        # Privilege Tiering
        p_tier = PrivilegeTier.LOW
        if "roles/owner" in roles_lower:
            p_tier = PrivilegeTier.CRITICAL
        elif is_high_risk or any(r in roles for r in PRIVILEGED_ROLES):
            p_tier = PrivilegeTier.HIGH
        elif len(roles) > 2:
            p_tier = PrivilegeTier.MEDIUM

        return UnifiedIdentity(
            id=f"gcp-{email}",
            email=email,
            source=self.source,
            roles=roles,
            mfaEnabled=True, # GCP users are usually MFA protected at the workspace level
            lastLogin=datetime.utcnow(),
            isActive=True,
            riskScore=min(risk_score, 100.0),
            linkedAccounts=[],
            groupMembership=[],
            privilegeTier=p_tier,
            exposureLevel=risk_score * 0.7,
            cloudAccounts=[os.getenv("GCP_PROJECT_ID", "gcp-project")]
        )
