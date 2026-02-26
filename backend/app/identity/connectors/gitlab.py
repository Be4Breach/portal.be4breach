import logging
from typing import List, Dict, Any
from app.identity.connectors.base import BaseConnector
from app.models import UnifiedIdentity, IdentitySource
from datetime import datetime

logger = logging.getLogger(__name__)

class GitLabConnector(BaseConnector):
    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(IdentitySource.GITLAB, credentials)

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        """Fetch raw identity data from GitLab API."""
        import httpx
        
        token = self.credentials.get("token")
        base_url = self.credentials.get("base_url", "https://gitlab.com")

        if not token:
            logger.warning("GitLab credentials missing token. Falling back to simulation.")
            return [
                {
                    "id": 500,
                    "username": "gl-admin",
                    "email": "admin@company.com",
                    "state": "active",
                    "is_admin": True,
                    "last_sign_in_at": "2026-02-20T11:45:00Z",
                    "two_factor_enabled": True,
                    "groups": ["root-group", "security-team"]
                }
            ]

        async with httpx.AsyncClient() as client:
            try:
                headers = {"Private-Token": token}
                response = await client.get(f"{base_url}/api/v4/users?per_page=100", headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"GitLab API error: {str(e)}")
                raise e

    def normalize(self, raw_data: Dict[str, Any]) -> UnifiedIdentity:
        risk_score = 0.04
        if not raw_data.get("two_factor_enabled", False):
            risk_score += 0.5
        if raw_data.get("is_admin"):
            risk_score += 0.2

        return UnifiedIdentity(
            id=str(raw_data["id"]),
            email=raw_data["email"],
            source=self.source,
            roles=["Owner"] if raw_data.get("is_admin") else ["Developer"],
            mfaEnabled=raw_data.get("two_factor_enabled", False),
            lastLogin=datetime.fromisoformat(raw_data["last_sign_in_at"].replace("Z", "+00:00")) if raw_data.get("last_sign_in_at") else None,
            isActive=raw_data["state"] == "active",
            riskScore=round(min(risk_score, 1.0), 2),
            linkedAccounts=[],
            groupMembership=raw_data.get("groups", [])
        )
