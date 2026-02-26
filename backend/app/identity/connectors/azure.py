import logging
from typing import List, Dict, Any
from app.identity.connectors.base import BaseConnector
from app.models import UnifiedIdentity, IdentitySource
from datetime import datetime

logger = logging.getLogger(__name__)

class AzureConnector(BaseConnector):
    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(IdentitySource.AZURE, credentials)

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        """Fetch raw identity data from MS Graph API."""
        import httpx
        
        tenant_id = self.credentials.get("tenant_id")
        client_id = self.credentials.get("client_id")
        client_secret = self.credentials.get("client_secret")

        if not tenant_id or not client_id or not client_secret:
            logger.warning("Azure credentials missing. Falling back to simulation.")
            return [
                {
                    "id": "azure-u1",
                    "userPrincipalName": "admin@company.onmicrosoft.com",
                    "displayName": "Azure Admin",
                    "accountEnabled": True,
                    "assignedRoles": ["Global Administrator", "Security Administrator"],
                    "mfaRegistration": {"isMfaRegistered": True},
                    "lastSignInDateTime": "2026-02-20T11:00:00Z",
                    "memberOf": ["Tenant-Admins", "Compliance-Group"]
                }
            ]

        async with httpx.AsyncClient() as client:
            try:
                # 1. Get Access Token
                token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
                token_data = {
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "scope": "https://graph.microsoft.com/.default"
                }
                token_resp = await client.post(token_url, data=token_data)
                token_resp.raise_for_status()
                access_token = token_resp.json().get("access_token")
                
                # 2. Fetch Users
                headers = {"Authorization": f"Bearer {access_token}"}
                users_resp = await client.get("https://graph.microsoft.com/v1.0/users?$select=id,userPrincipalName,displayName,accountEnabled,lastSignInDateTime", headers=headers)
                users_resp.raise_for_status()
                return users_resp.json().get("value", [])
            except Exception as e:
                logger.error(f"Azure MS Graph API error: {str(e)}")
                raise e

    def normalize(self, raw_data: Dict[str, Any]) -> UnifiedIdentity:
        risk_score = 0.05
        if not raw_data.get("mfaRegistration", {}).get("isMfaRegistered", False):
            risk_score += 0.5
        if "Global Administrator" in raw_data.get("assignedRoles", []):
            risk_score += 0.3

        return UnifiedIdentity(
            id=raw_data["id"],
            email=raw_data["userPrincipalName"],
            source=self.source,
            roles=raw_data.get("assignedRoles", []),
            mfaEnabled=raw_data.get("mfaRegistration", {}).get("isMfaRegistered", False),
            lastLogin=datetime.fromisoformat(raw_data["lastSignInDateTime"].replace("Z", "+00:00")) if raw_data.get("lastSignInDateTime") else None,
            isActive=raw_data.get("accountEnabled", True),
            riskScore=round(min(risk_score, 1.0), 2),
            linkedAccounts=[],
            groupMembership=raw_data.get("memberOf", [])
        )
