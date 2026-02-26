import logging
from typing import List, Dict, Any
from app.identity.connectors.base import BaseConnector
from app.models import UnifiedIdentity, IdentitySource
from datetime import datetime

logger = logging.getLogger(__name__)

class AWSConnector(BaseConnector):
    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(IdentitySource.AWS, credentials)

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        """Fetch raw identity data from AWS IAM."""
        import boto3
        from botocore.exceptions import ClientError
        
        aws_access_key = self.credentials.get("aws_access_key_id")
        aws_secret_key = self.credentials.get("aws_secret_access_key")
        region = self.credentials.get("region", "us-east-1")

        if not aws_access_key or not aws_secret_key:
            logger.warning("AWS credentials missing. Falling back to simulation.")
            return [
                {
                    "UserName": "cloud-admin",
                    "UserId": "aws-u1",
                    "Arn": "arn:aws:iam::123456789012:user/cloud-admin",
                    "CreateDate": "2025-01-01T00:00:00Z",
                    "PasswordLastUsed": "2026-02-20T08:00:00Z",
                    "MfaEnabled": True,
                    "Roles": ["AdministratorAccess"],
                    "Groups": ["Cloud-Ops", "Security-Admins"],
                    "Status": "Active"
                }
            ]

        try:
            iam = boto3.client(
                'iam',
                aws_access_key_id=aws_access_key,
                aws_secret_access_key=aws_secret_key,
                region_name=region
            )
            
            # This is a synchronous call, in production you'd use a thread pool or aiobotocore
            # For simplicity here, we use boto3 directly
            response = iam.list_users(MaxItems=100)
            users = response.get('Users', [])
            
            # Enrich with MFA status (requires separate calls per user)
            for user in users:
                mfa = iam.list_mfa_devices(UserName=user['UserName'])
                user['MfaEnabled'] = len(mfa.get('MFADevices', [])) > 0
                user['Status'] = 'Active' # Basic assumption
                
            return users
        except ClientError as e:
            logger.error(f"AWS IAM API error: {str(e)}")
            raise e

    def normalize(self, raw_data: Dict[str, Any]) -> UnifiedIdentity:
        # AWS users often don't have a direct email attribute in IAM list_users
        # We append a domain for normalization consistency
        email = raw_data["UserName"]
        if "@" not in email:
            email = f"{email}@company.aws"

        # Risk Score Calculation: Higher if MFA is disabled
        risk_score = 0.05
        if not raw_data.get("MfaEnabled", False):
            risk_score += 0.4
        if "AdministratorAccess" in raw_data.get("Roles", []):
            risk_score += 0.2

        return UnifiedIdentity(
            id=raw_data["UserId"],
            email=email,
            source=self.source,
            roles=raw_data.get("Roles", []),
            mfaEnabled=raw_data.get("MfaEnabled", False),
            lastLogin=datetime.fromisoformat(raw_data["PasswordLastUsed"].replace("Z", "+00:00")) if raw_data.get("PasswordLastUsed") else None,
            isActive=raw_data.get("Status") == "Active",
            riskScore=round(min(risk_score, 1.0), 2),
            linkedAccounts=[],
            groupMembership=raw_data.get("Groups", [])
        )
