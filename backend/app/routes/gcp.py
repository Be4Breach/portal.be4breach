from fastapi import APIRouter, Depends, HTTPException
from google.cloud import resourcemanager_v3
from google.oauth2 import service_account
from google.cloud import iam_admin_v1
import os
import logging
from app.database import database, DB_AVAILABLE
from app.auth import get_current_user
from app.models import IdentitySource, PrivilegeTier, UnifiedIdentity
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter()

def get_gcp_credentials():
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path or not os.path.exists(creds_path):
        return None
    try:
        return service_account.Credentials.from_service_account_file(creds_path)
    except Exception:
        return None

@router.get("/status")
async def get_gcp_status(current_user: dict = Depends(get_current_user)):
    project_id = os.getenv("GCP_PROJECT_ID")
    creds = get_gcp_credentials()
    
    if not creds or not project_id:
        return {"connected": False, "error": "GCP Not Configured"}
    
    try:
        # Get project info
        rm_client = resourcemanager_v3.ProjectsClient(credentials=creds)
        project = rm_client.get_project(name=f"projects/{project_id}")
        
        # Get IAM policy to count users/roles
        policy = rm_client.get_iam_policy(resource=f"projects/{project_id}")
        
        users = set()
        sas = set()
        privileged = set()
        
        PRIVILEGED_ROLES = [
            "roles/owner", "roles/editor",
            "roles/iam.securityAdmin",
            "roles/resourcemanager.projectIamAdmin",
        ]
        
        for binding in policy.bindings:
            is_priv = binding.role in PRIVILEGED_ROLES
            for member in binding.members:
                if member.startswith("user:"):
                    email = member.replace("user:", "")
                    users.add(email)
                    if is_priv: privileged.add(email)
                elif member.startswith("serviceAccount:"):
                    email = member.replace("serviceAccount:", "")
                    sas.add(email)
                    if is_priv: privileged.add(email)
        
        # Try to get last sync from DB
        last_sync = None
        if DB_AVAILABLE:
            config = await database.get_collection("provider_configs").find_one({"source": "gcp"})
            if config:
                last_sync = config.get("last_sync")
        
        if not last_sync:
            last_sync = datetime.utcnow()
        
        return {
            "connected": True,
            "project_id": project_id,
            "project_name": project.display_name,
            "total_users": len(users),
            "service_accounts": len(sas),
            "privileged_accounts": len(privileged),
            "last_sync": last_sync.isoformat() if isinstance(last_sync, datetime) else last_sync
        }
    except Exception as e:
        logger.error(f"GCP Status Check Error: {str(e)}")
        return {"connected": False, "error": "GCP Not Configured"}

@router.post("/sync")
async def sync_gcp(current_user: dict = Depends(get_current_user)):
    project_id = os.getenv("GCP_PROJECT_ID")
    creds = get_gcp_credentials()
    
    if not creds or not project_id:
        raise HTTPException(status_code=400, detail="GCP Not Configured")
    
    try:
        # 1. Fetch IAM Policy for the project
        rm_client = resourcemanager_v3.ProjectsClient(credentials=creds)
        policy = rm_client.get_iam_policy(resource=f"projects/{project_id}")
        
        # 2. Fetch Service Accounts to check for active keys
        iam_client = iam_admin_v1.IAMClient(credentials=creds)
        service_accounts = iam_client.list_service_accounts(name=f"projects/{project_id}")
        
        sa_has_active_keys = {}
        for sa in service_accounts:
            keys = iam_client.list_service_account_keys(name=sa.name)
            active_keys = [k for k in keys.keys if k.key_type == iam_admin_v1.ServiceAccountKey.KeyType.USER_MANAGED]
            sa_has_active_keys[sa.email] = len(active_keys) > 0

        # 3. Process Bindings
        identities_map = {} 
        
        PRIVILEGED_ROLES = [
            "roles/owner", "roles/editor",
            "roles/iam.securityAdmin",
            "roles/resourcemanager.projectIamAdmin",
        ]

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
                    identities_map[email] = {"roles": [], "type": m_type}
                identities_map[email]["roles"].append(role)

        # 4. Normalize and Save to DB
        results = []
        sync_time = datetime.utcnow()
        
        for email, info in identities_map.items():
            roles = info["roles"]
            is_sa = info["type"] == "serviceAccount"
            roles_lower = [r.lower() for r in roles]
            
            risk_score = 10 
            is_high_risk = False
            is_privileged = any(r in roles for r in PRIVILEGED_ROLES)
            
            if "roles/owner" in roles_lower:
                risk_score += 80
                is_high_risk = True
            elif "roles/editor" in roles_lower:
                risk_score += 60
                is_high_risk = True
            elif "roles/iam.securityadmin" in roles_lower or "roles/resourcemanager.projectiamadmin" in roles_lower:
                risk_score += 50
                is_high_risk = True
            
            if is_sa and sa_has_active_keys.get(email, False):
                risk_score += 40
                is_high_risk = True
                
            risk_score = min(risk_score, 100)
            
            p_tier = PrivilegeTier.LOW
            if "roles/owner" in roles_lower:
                p_tier = PrivilegeTier.CRITICAL
            elif "roles/editor" in roles_lower or "roles/iam.securityadmin" in roles_lower or "roles/resourcemanager.projectiamadmin" in roles_lower or is_high_risk:
                p_tier = PrivilegeTier.HIGH
            elif len(roles) > 2:
                p_tier = PrivilegeTier.MEDIUM

            identity = UnifiedIdentity(
                id=f"gcp-{project_id}-{email}",
                email=email,
                source=IdentitySource.GCP,
                roles=roles,
                mfaEnabled=True, # GCP Workspace users usually have MFA or we assume healthy for IAM
                isActive=True,
                riskScore=float(risk_score),
                privilegeTier=p_tier,
                exposureLevel=float(risk_score * 0.7),
                cloudAccounts=[project_id],
                lastLogin=sync_time
            )
            
            if DB_AVAILABLE:
                await database.get_collection("unified_identities").update_one(
                    {"id": identity.id, "source": IdentitySource.GCP},
                    {"$set": identity.dict()},
                    upsert=True
                )
                
            results.append(identity.dict())
            
        # Update provider config last_sync
        if DB_AVAILABLE:
            await database.get_collection("provider_configs").update_one(
                {"source": "gcp"},
                {"$set": {
                    "last_sync": sync_time,
                    "is_active": True,
                    "credentials": {"project_id": project_id} # Minimum metadata
                }},
                upsert=True
            )
            # Store sync snapshot for trend tracking
            privileged_count = sum(1 for r in results if r.get("privilegeTier") in ["high", "critical"])
            await database.get_collection("sync_history").insert_one({
                "provider": "gcp",
                "timestamp": sync_time,
                "total_synced": len(results),
                "privileged_count": privileged_count,
                "risk_scores": [r.get("riskScore", 0) for r in results],
                "avg_risk": sum(r.get("riskScore", 0) for r in results) / max(len(results), 1)
            })
            
        return {"message": f"Successfully synced {len(results)} identities from GCP.", "count": len(results)}
        
    except Exception as e:
        logger.error(f"GCP Sync Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"GCP Sync Failed: {str(e)}")
