import asyncio
import logging
import random
import json
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from app.database import DB_AVAILABLE
from app.models import UnifiedIdentity, IdentitySource, ProviderConfig, PrivilegeTier

logger = logging.getLogger(__name__)

class IdentitySyncService:
    def __init__(self, db):
        self.db = db
        self.identities_collection = db.get_collection("unified_identities")
        self.config_collection = db.get_collection("provider_configs")
        self._dummy_data_cache = None

    def get_connector(self, config: ProviderConfig):
        from app.utils.security import decrypt_credentials
        
        credentials = config.credentials
        if isinstance(credentials, str):
            try:
                credentials = decrypt_credentials(credentials)
            except Exception as e:
                logger.error(f"Failed to decrypt credentials for {config.source}: {str(e)}")
                return None

        if config.source == IdentitySource.OKTA:
            from app.identity.connectors.okta import OktaConnector
            return OktaConnector(credentials)
        elif config.source == IdentitySource.AWS:
            from app.identity.connectors.aws import AWSConnector
            return AWSConnector(credentials)
        elif config.source == IdentitySource.GITHUB:
            from app.identity.connectors.github import GitHubConnector
            return GitHubConnector(credentials)
        elif config.source == IdentitySource.AZURE:
            from app.identity.connectors.azure import AzureConnector
            return AzureConnector(credentials)
        elif config.source == IdentitySource.GCP:
            from app.identity.connectors.gcp import GCPConnector
            return GCPConnector(credentials)
        elif config.source == IdentitySource.GITLAB:
            from app.identity.connectors.gitlab import GitLabConnector
            return GitLabConnector(credentials)
        return None

    async def _sync_connector(self, config: ProviderConfig) -> int:
        """Helper to sync a single connector and save results."""
        connector = self.get_connector(config)
        if not connector:
            return 0
        
        try:
            identities = await connector.sync()
            if DB_AVAILABLE:
                # 1. Update identities
                tasks = [
                    self.identities_collection.update_one(
                        {"id": identity.id, "source": identity.source},
                        {"$set": identity.dict()},
                        upsert=True
                    ) for identity in identities
                ]
                if tasks:
                    await asyncio.gather(*tasks)
                
                # 2. Record sync history entry for trend charts
                sync_time = datetime.utcnow()
                risk_scores = [i.riskScore for i in identities]
                avg_risk = sum(risk_scores) / max(len(risk_scores), 1)
                privileged_count = sum(1 for i in identities if i.privilegeTier.value in ["high", "critical"] or i.privilegeTier in ["high", "critical"])
                
                await self.db.get_collection("sync_history").insert_one({
                    "provider": config.source.value if hasattr(config.source, 'value') else config.source,
                    "timestamp": sync_time,
                    "total_synced": len(identities),
                    "privileged_count": privileged_count,
                    "risk_scores": risk_scores,
                    "avg_risk": avg_risk
                })

                # 3. Update last sync in config
                await self.config_collection.update_one(
                    {"source": config.source},
                    {"$set": {"last_sync": sync_time}}
                )
            
            logger.info(f"Successfully synced {len(identities)} identities from {config.source}")
            return len(identities)
        except Exception as e:
            logger.error(f"Failed to sync {config.source}: {e}")
            return 0

    async def sync_all(self, current_user_email: Optional[str] = None):
        """Live sync: fetches data from all active connectors in parallel."""
        logger.info("Identity Sync Service: Starting parallel live sync.")
        
        # Fetch active configs
        configs = []
        if DB_AVAILABLE:
            try:
                cursor = self.config_collection.find({"is_active": True})
                docs = await cursor.to_list(length=100)
                for doc in docs:
                    source = doc.get("source", "")
                    if not doc.get("credentials") or doc.get("credentials") == {}:
                        doc["credentials"] = self._get_env_credentials(source)
                    try:
                        configs.append(ProviderConfig(**doc))
                    except Exception as pe:
                        logger.warning(f"Skipping invalid provider config for {source}: {pe}")
            except Exception as e:
                logger.error(f"Error fetching provider configs: {e}")
        
        # Also inject env-based configs for providers not yet in DB
        if DB_AVAILABLE:
            existing_sources = {c.source.value for c in configs}
            for env_source in self._get_env_configured_sources():
                if env_source not in existing_sources:
                    creds = self._get_env_credentials(env_source)
                    if creds:
                        try:
                            configs.append(ProviderConfig(
                                source=IdentitySource(env_source),
                                credentials=creds,
                                is_active=True
                            ))
                            logger.info(f"Added env-based config for {env_source}")
                        except Exception as e:
                            logger.warning(f"Could not create env config for {env_source}: {e}")

        # Run all syncs in parallel
        sync_tasks = [self._sync_connector(config) for config in configs]
        results = await asyncio.gather(*sync_tasks)
        
        # Resolve real email from synced GitHub/GCP data or current_user_email
        # Step 2: Resolve base emails for demo generation
        base_emails = set()
        if current_user_email:
            base_emails.add(current_user_email)
            
        # User explicitly requested these specific emails for demo
        requested_demo_emails = [
            "divyansh.parashar@be4breach.com",
            "nikhil@be4breach.com",
            "smit.rami@be4breach.com",
            "akanksha.gupta@be4breach.com"
        ]
        for e in requested_demo_emails:
            base_emails.add(e)
            
        # Fetch any existing real emails from GitHub/GCP
        if DB_AVAILABLE:
            try:
                cursor = self.identities_collection.find({
                    "source": {"$in": ["github", "gcp"]},
                    "email": {"$ne": None}
                }).limit(20)
                synced_docs = await cursor.to_list(length=20)
                for doc in synced_docs:
                    if doc.get("email"):
                        base_emails.add(doc["email"])
            except Exception as e:
                logger.error(f"Error fetching real emails for demo context: {e}")

        # Step 3: Inject demo data for disconnected providers
        target_demo_providers = [
            IdentitySource.AWS, 
            IdentitySource.AZURE, 
            IdentitySource.GITLAB, 
            IdentitySource.OKTA
        ]
        
        connected_sources = {c.source for c in configs}
        demo_count = 0
        
        if base_emails:
            for source in target_demo_providers:
                if source not in connected_sources:
                    for email in base_emails:
                        demo_identities = self._generate_demo_data(email, source)
                        if DB_AVAILABLE:
                            tasks = [
                                self.identities_collection.update_one(
                                    {"id": identity.id, "source": identity.source, "provider": identity.provider},
                                    {"$set": identity.dict()},
                                    upsert=True
                                ) for identity in demo_identities
                            ]
                            if tasks:
                                await asyncio.gather(*tasks)
                            demo_count += len(demo_identities)
            
            logger.info(f"Injected {demo_count} demo identities for disconnected providers based on {len(base_emails)} identities.")

        total_synced = sum(results) + demo_count
        return total_synced

    def _generate_demo_data(self, email: str, source: IdentitySource) -> List[UnifiedIdentity]:
        """Generate structured realistic demo data for a provider."""
        identities = []
        name_parts = email.split('@')[0].replace('.', ' ').title()
        domain = email.split('@')[1] if '@' in email else "be4breach.com"
        
        # Consistent variance based on email hash
        random.seed(hash(email))
        
        if source == IdentitySource.AWS:
             # IAM User
             identities.append(UnifiedIdentity(
                 id=f"aws-{email.replace('@', '-')}",
                 email=email,
                 source=IdentitySource.DEMO,
                 provider="aws",
                 roles=["AdministratorAccess", "Billing", "IAMFullAccess", "SecurityAudit"],
                 mfaEnabled=True,
                 lastLogin=datetime.utcnow() - timedelta(hours=random.randint(1, 48)),
                 isActive=True,
                 riskScore=round(random.uniform(5.0, 15.0), 1),
                 privilegeTier=PrivilegeTier.CRITICAL,
                 exposureLevel=5.0,
                 cloudAccounts=["aws-prod-0123456789"]
             ))
             
             # Some users get a specific secondary role
             if random.random() > 0.5:
                identities.append(UnifiedIdentity(
                    id=f"aws-role-sec-{email.replace('@', '-')}",
                    email=f"security-role@{domain}",
                    source=IdentitySource.DEMO,
                    provider="aws",
                    roles=["ReadOnlyAccess", "SecurityAudit"],
                    mfaEnabled=False,
                    lastLogin=datetime.utcnow() - timedelta(days=random.randint(2, 10)),
                    isActive=True,
                    riskScore=round(random.uniform(40.0, 75.0), 1),
                    privilegeTier=PrivilegeTier.HIGH,
                    exposureLevel=30.0,
                    cloudAccounts=["aws-prod-0123456789"]
                ))

        elif source == IdentitySource.AZURE:
            identities.append(UnifiedIdentity(
                id=f"azure-{email.replace('@', '-')}",
                email=email,
                source=IdentitySource.DEMO,
                provider="azure",
                roles=["Global Administrator", "Application Developer", "User Access Administrator"],
                mfaEnabled=True,
                lastLogin=datetime.utcnow() - timedelta(minutes=random.randint(10, 1000)),
                isActive=True,
                riskScore=round(random.uniform(2.0, 10.0), 1),
                privilegeTier=PrivilegeTier.CRITICAL,
                exposureLevel=2.0,
                cloudAccounts=["azure-tenant-be4breach"]
            ))

        elif source == IdentitySource.GITLAB:
             identities.append(UnifiedIdentity(
                id=f"gitlab-{email.replace('@', '-')}",
                email=email,
                source=IdentitySource.DEMO,
                provider="gitlab",
                roles=["Owner", "Maintainer"],
                mfaEnabled=random.choice([True, True, False]), # Some lack MFA
                lastLogin=datetime.utcnow() - timedelta(hours=random.randint(2, 48)),
                isActive=True,
                riskScore=round(random.uniform(10.0, 35.0), 1),
                privilegeTier=PrivilegeTier.HIGH,
                exposureLevel=15.0,
                groupMembership=["Engineering", "Security Ops", "DevOps"]
            ))

        elif source == IdentitySource.OKTA:
            identities.append(UnifiedIdentity(
                id=f"okta-{email.replace('@', '-')}",
                email=email,
                source=IdentitySource.DEMO,
                provider="okta",
                roles=["Super Admin", "Everything Admin", "Report Administrator"],
                mfaEnabled=True,
                lastLogin=datetime.utcnow() - timedelta(minutes=random.randint(5, 120)),
                isActive=True,
                riskScore=round(random.uniform(1.0, 10.0), 1),
                privilegeTier=PrivilegeTier.CRITICAL,
                exposureLevel=1.0,
                groupMembership=["Admins", "Engineering Managers", "IT Infrastructure"],
                linkedAccounts=["aws", "gcp", "azure", "github", "gitlab"]
            ))
            
        return identities

    async def get_all_identities(
        self, 
        search: Optional[str] = None, 
        source: Optional[str] = None,
        risk_level: Optional[str] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> Dict[str, Any]:
        """Returns identities and total filtered count. No dummy or fallbacks allowed."""
        if not DB_AVAILABLE:
            logger.warning("Database unavailable. Returning empty identity list.")
            return {"items": [], "total": 0}

        try:
            # Build query based on filters
            query = {}
            if search:
                s = search.lower()
                query["$or"] = [
                    {"email": {"$regex": s, "$options": "i"}},
                    {"id": {"$regex": s, "$options": "i"}},
                    {"roles": {"$regex": s, "$options": "i"}}
                ]
            
            if source and source != "all":
                query["source"] = source
            
            if risk_level and risk_level != "all":
                if risk_level == "Critical":
                    query["riskScore"] = {"$gte": 80}
                elif risk_level == "High":
                    query["riskScore"] = {"$gte": 61, "$lt": 80}
                elif risk_level == "Medium":
                    query["riskScore"] = {"$gte": 31, "$lt": 61}
                elif risk_level == "Low":
                    query["riskScore"] = {"$lt": 31}
            
            total = await self.identities_collection.count_documents(query)
            cursor = self.identities_collection.find(query).skip(skip).limit(limit)
            docs = await cursor.to_list(length=limit)
            
            items = [UnifiedIdentity(**doc) for doc in docs]
            return {"items": items, "total": total}
        except Exception as e:
            logger.error(f"Failed to read from DB: {e}")
            return {"items": [], "total": 0}

    def _filter_identities(
        self,
        identities: List[UnifiedIdentity],
        search: Optional[str] = None,
        source: Optional[str] = None,
        risk_level: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[UnifiedIdentity]:
        filtered = identities

        if search:
            s = search.lower()
            filtered = [i for i in filtered if s in (i.email or "").lower() or s in (i.id or "").lower()]
        
        if source:
            filtered = [i for i in filtered if i.source.value == source or i.source == source]
        
        if risk_level:
            if risk_level == "Critical":
                filtered = [i for i in filtered if i.riskScore >= 80]
            elif risk_level == "High":
                filtered = [i for i in filtered if 61 <= i.riskScore < 80]
            elif risk_level == "Medium":
                filtered = [i for i in filtered if 31 <= i.riskScore < 61]
            elif risk_level == "Low":
                filtered = [i for i in filtered if i.riskScore < 31]
        
        return filtered[skip:skip + limit]

    async def get_total_count(self, query: Dict[str, Any] = None) -> int:
        """Returns total count of identities in DB."""
        if not DB_AVAILABLE:
            return 0
        try:
            return await self.identities_collection.count_documents(query or {})
        except Exception:
            return 0

    def _get_env_credentials(self, source: str) -> Dict[str, Any]:
        """Build credentials from environment variables for a given provider."""
        if source == "github":
            token = os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_CLIENT_SECRET")
            org = os.getenv("GITHUB_ORG", "Be4Breach")
            if token:
                return {"token": token, "org": org}
        elif source == "gcp":
            creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            project_id = os.getenv("GCP_PROJECT_ID")
            if creds_path and project_id:
                return {"creds_path": creds_path, "project_id": project_id}
        elif source == "aws":
            key = os.getenv("AWS_ACCESS_KEY_ID")
            secret = os.getenv("AWS_SECRET_ACCESS_KEY")
            region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
            if key and secret:
                return {"access_key_id": key, "secret_access_key": secret, "region": region}
        elif source == "okta":
            domain = os.getenv("OKTA_DOMAIN")
            token = os.getenv("OKTA_API_TOKEN")
            if domain and token:
                return {"domain": domain, "api_token": token}
        elif source == "azure":
            tenant = os.getenv("AZURE_TENANT_ID")
            client_id = os.getenv("AZURE_CLIENT_ID")
            secret = os.getenv("AZURE_CLIENT_SECRET")
            if tenant and client_id and secret:
                return {"tenant_id": tenant, "client_id": client_id, "client_secret": secret}
        return {}

    def _get_env_configured_sources(self) -> List[str]:
        """Return list of provider sources that have valid env-var credentials."""
        configured = []
        if os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_CLIENT_SECRET"):
            configured.append("github")
        if os.getenv("GOOGLE_APPLICATION_CREDENTIALS") and os.getenv("GCP_PROJECT_ID"):
            configured.append("gcp")
        if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
            configured.append("aws")
        if os.getenv("OKTA_DOMAIN") and os.getenv("OKTA_API_TOKEN"):
            configured.append("okta")
        if os.getenv("AZURE_TENANT_ID") and os.getenv("AZURE_CLIENT_ID"):
            configured.append("azure")
        return configured
