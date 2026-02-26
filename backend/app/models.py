from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    company_name: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    company_name: str
    role: str
    is_approved: bool

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class OktaConfig(BaseModel):
    domain: str
    api_token: str

class AuditLogEntry(BaseModel):
    action: str
    adminUser: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = None

class IdentitySource(str, Enum):
    AWS = "aws"
    AZURE = "azure"
    GCP = "gcp"
    OKTA = "okta"
    GITHUB = "github"
    GITLAB = "gitlab"
    HR = "hr"
    DEMO = "demo"

class PrivilegeTier(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class UnifiedIdentity(BaseModel):
    id: str
    email: str
    source: IdentitySource
    provider: Optional[str] = None  # Original provider for demo data
    roles: List[str] = []
    mfaEnabled: bool = False
    lastLogin: Optional[datetime] = None
    isActive: bool = True
    riskScore: float = 0.0
    linkedAccounts: List[str] = []
    groupMembership: List[str] = []
    privilegeTier: PrivilegeTier = PrivilegeTier.LOW
    exposureLevel: float = 0.0
    attackPathCount: int = 0
    blastRadius: int = 0
    permissions: List[str] = []
    cloudAccounts: List[str] = []

class ProviderConfig(BaseModel):
    source: IdentitySource
    credentials: Dict[str, Any]
    is_active: bool = True
    last_sync: Optional[datetime] = None

class CopilotQuery(BaseModel):
    query: str
    context_identity_id: Optional[str] = None

class CopilotResponse(BaseModel):
    answer: str
    sources: List[str] = []
    confidence: float = 0.0
    suggestions: List[str] = []
