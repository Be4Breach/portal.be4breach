import logging
from typing import List, Dict, Any
from app.identity.connectors.base import BaseConnector
from app.models import UnifiedIdentity, IdentitySource
from datetime import datetime

logger = logging.getLogger(__name__)

class OktaConnector(BaseConnector):
    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(IdentitySource.OKTA, credentials)

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        """Fetch raw identity data from Okta API."""
        import httpx
        
        domain = self.credentials.get("domain")
        api_token = self.credentials.get("api_token")
        
        if not domain or not api_token:
            logger.warning("Okta credentials missing domain or api_token. Falling back to simulation.")
            return [
                {
                    "id": "okta-u1",
                    "profile": {"email": "admin@company.com", "login": "admin@company.com"},
                    "status": "ACTIVE",
                    "lastLogin": "2026-02-20T10:00:00Z",
                    "mfa_registered": True,
                    "assigned_roles": ["Super Admin", "App Admin"],
                    "groups": ["Admins", "IT-Support", "Global-Access"]
                }
            ]

        # Ensure domain starts with https://
        if not domain.startswith("http"):
            domain = f"https://{domain}"
            
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"SSWS {api_token}",
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
            
            try:
                # Fetch Users
                response = await client.get(f"{domain}/api/v1/users?limit=50", headers=headers)
                response.raise_for_status()
                users = response.json()
                
                # Fetch groups/roles for each user (simplified for this task)
                # In a real scenario, you'd iterate and fetch more details
                return users
            except Exception as e:
                logger.error(f"Okta API error: {str(e)}")
                raise e

    def normalize(self, raw_data: Dict[str, Any]) -> UnifiedIdentity:
        risk_score = 0.1
        if not raw_data.get("mfa_registered", False):
            risk_score += 0.7
        if "Super Admin" in raw_data.get("assigned_roles", []):
            risk_score += 0.2

        return UnifiedIdentity(
            id=raw_data["id"],
            email=raw_data["profile"]["email"],
            source=self.source,
            roles=raw_data.get("assigned_roles", []),
            mfaEnabled=raw_data.get("mfa_registered", False),
            lastLogin=datetime.fromisoformat(raw_data["lastLogin"].replace("Z", "+00:00")) if raw_data.get("lastLogin") else None,
            isActive=raw_data["status"] == "ACTIVE",
            riskScore=round(min(risk_score, 1.0), 2),
            linkedAccounts=[],
            groupMembership=raw_data.get("groups", [])
        )
