from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import os
from groq import Groq
import json
import logging
from app.database import scans_collection, findings_collection, database
from app.identity.sync_service import IdentitySyncService
from app.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize sync service
sync_service = IdentitySyncService(database)

# Use the provided GROQ API KEY directly if environment variable is not set
# Use the provided GROQ API KEY
GROQ_KEY = os.environ.get("GROQ_API_KEY", "default")
client = Groq(api_key=GROQ_KEY)

class ChatRequest(BaseModel):
    query: str
    context_filters: Dict[str, Any] = {}

class ChatResponse(BaseModel):
    response: str

@router.post("/chat", response_model=ChatResponse)
async def ai_chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    query = request.query
    github_login = current_user.get("github_login") or current_user.get("email")
    
    # 1. Fetch some basic context data to inject into the prompt
    
    # Check if a specific project/repo is mentioned in the query
    known_repos = [doc["repo_full_name"] async for doc in scans_collection.find({"github_login": github_login}, {"repo_full_name": 1})]
    mentioned_repos = [repo for repo in known_repos if repo and (repo.lower() in query.lower() or repo.split("/")[-1].lower() in query.lower())]

    if mentioned_repos:
        repo_name = mentioned_repos[0]
        # Fetch scan details for this specific project
        scan = await scans_collection.find_one({"repo_full_name": repo_name, "github_login": github_login}, sort=[("created_at", -1)])
        # Fetch findings for this project
        pipeline = [
            {"$match": {"repo_full_name": repo_name, "github_login": github_login}},
            {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
        ]
        severity_counts = {}
        async for doc in findings_collection.aggregate(pipeline):
            severity = doc.get("_id") or "UNKNOWN"
            severity_counts[severity] = doc.get("count", 0)
        
        # Get a few sample findings for context
        sample_findings = []
        async for f in findings_collection.find({"repo_full_name": repo_name, "github_login": github_login, "severity": {"$in": ["ERROR", "CRITICAL", "WARNING"]}}).limit(5):
             sample_findings.append(f.get("message", "Unknown issue")[:200]) # Trim to avoid massive token usage

        context_data = f"""
        Here is the specific security posture data for the project '{repo_name}' from the database:
        - Scan Status: {scan.get('status') if scan else 'No scan found'}
        - Total Findings: {scan.get('finding_count', 0) if scan else 0}
        - Vulnerabilities by Severity: {json.dumps(severity_counts)}
        - Sample High/Critical Issues: {json.dumps(sample_findings)}
        """
    else:
        # Fetch general context (total scans, all findings)
        total_scans = await scans_collection.count_documents({"github_login": github_login})
        pipeline = [
            {"$match": {"github_login": github_login}},
            {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
        ]
        severity_counts = {}
        async for doc in findings_collection.aggregate(pipeline):
            severity = doc.get("_id") or "UNKNOWN"
            severity_counts[severity] = doc.get("count", 0)
        
        context_data = f"""
        Here is the overall security posture data across all projects in the database:
        - Total Projects/Scans: {total_scans}
        - Vulnerabilities by Severity: {json.dumps(severity_counts)}
        - Note: The user didn't specify a project name that matches our database records. The known projects are: {', '.join([repo.split('/')[-1] for repo in known_repos if repo])}.
        """

    # 2. Fetch Identity Analyzer Context
    try:
        identity_resp = await sync_service.get_all_identities(limit=1000)
        identities = identity_resp["items"]
        
        from app.identity.graph_engine import EnhancedRiskEngine
        engine = EnhancedRiskEngine(identities)
        
        global_risk = engine.get_global_risk_score()
        mfa_cov = engine.get_mfa_coverage()
        
        # Calculate some additional metrics for the AI to have more detail
        admin_count = sum(1 for i in identities if any("admin" in (r.lower() if isinstance(r, str) else "") for r in i.roles))
        critical_count = sum(1 for i in identities if i.riskScore >= 80)
        high_risk_count = sum(1 for i in identities if 60 <= i.riskScore < 80)
        
        # Map demo sources back to providers for AI clarity
        platforms = set()
        for i in identities:
            src = i.source.value if hasattr(i.source, 'value') else str(i.source)
            if src == "demo" and i.provider:
                src = i.provider
            platforms.add(src)
        
        identity_context = f"""
        Identity Analyzer Summary:
        - Total Identities Managed: {len(identities)}
        - Global Infrastructure Risk Score: {global_risk['score']}/100 ({global_risk['level']})
        - MFA Security Coverage: {mfa_cov['coverage']}%
        - Critical Risk Users (Scored 80+): {critical_count}
        - High Risk Users (Scored 60-79): {high_risk_count}
        - Total Privileged/Admin Accounts: {admin_count}
        - Connected Platforms: {', '.join(platforms)}
        """
    except Exception as e:
        identity_context = "\nIdentity Analyzer data is currently unavailable."
        logger.error(f"Error fetching identity context: {e}")

    # 3. Fetch Gitleaks / Secrets Scanning Context
    try:
        # Step 1: Find the latest completed gitleaks scan per repo for the current user.
        # scans_collection uses 'gitleaks_status' (not 'type') to track Gitleaks state.
        # $toString converts ObjectId to string so it matches findings_collection's scan_id field.
        latest_gitleaks_scans_pipeline = [
            {"$match": {"github_login": github_login, "gitleaks_status": "completed"}},
            {"$sort": {"completed_at": -1}},
            {"$group": {"_id": "$repo_full_name", "latest_scan_id": {"$first": {"$toString": "$_id"}}}}
        ]
        latest_scan_ids = [doc["latest_scan_id"] async for doc in scans_collection.aggregate(latest_gitleaks_scans_pipeline)]

        if not latest_scan_ids:
            gitleaks_context = """
            Secrets Detection (Gitleaks) Summary:
            - No completed Gitleaks scans found for your repositories.
            - Please ensure Gitleaks scans are configured and have completed successfully.
            """
        else:
            # Step 2: Aggregate secrets by severity across all repos for this user, using only latest scan IDs
            secrets_pipeline = [
                {"$match": {"github_login": github_login, "type": "gitleaks", "scan_id": {"$in": latest_scan_ids}}},
                {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
            ]
            secrets_by_severity = {}
            async for doc in findings_collection.aggregate(secrets_pipeline):
                sev = doc.get("_id") or "UNKNOWN"
                secrets_by_severity[sev] = doc.get("count", 0)

            total_secrets = sum(secrets_by_severity.values())

            # Repos that have secrets, using only latest scan IDs
            secrets_repos_pipeline = [
                {"$match": {"github_login": github_login, "type": "gitleaks", "scan_id": {"$in": latest_scan_ids}}},
                {"$group": {"_id": "$repo_full_name", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 5}
            ]
            repos_with_secrets = []
            async for doc in findings_collection.aggregate(secrets_repos_pipeline):
                if doc.get("_id"):
                    repos_with_secrets.append(f"{doc['_id']} ({doc['count']} secrets)")

            # Sample high/critical secret types (rule_ids), using only latest scan IDs
            sample_secrets = []
            async for f in findings_collection.find(
                {"github_login": github_login, "type": "gitleaks", "scan_id": {"$in": latest_scan_ids}, "severity": {"$in": ["CRITICAL", "HIGH"]}},
                {"rule_id": 1, "message": 1, "repo_full_name": 1}
            ).limit(5):
                rule = f.get("rule_id", "unknown")
                msg = (f.get("message") or "")[:120]
                repo = f.get("repo_full_name", "unknown")
                sample_secrets.append(f"{rule} in {repo}: {msg}")

            gitleaks_context = f"""
            Secrets Detection (Gitleaks) Summary:
            - Total Secrets/Credentials Found: {total_secrets}
            - Secrets by Severity: {json.dumps(secrets_by_severity)}
            - Top Repositories with Exposed Secrets: {', '.join(repos_with_secrets) if repos_with_secrets else 'None'}
            - Sample Critical/High Secret Findings: {json.dumps(sample_secrets)}
            """
    except Exception as e:
        gitleaks_context = "\nSecrets Detection (Gitleaks) data is currently unavailable."
        logger.error(f"Error fetching Gitleaks context: {e}")

    system_prompt = f"""
    You are the "Be4Breach Security Copilot" for Be4Breach, an enterprise platform for DevSecOps and Identity Security.
    Your objective is to provide professional, concise, and actionable security insights based on the context data provided.

    CONTEXT DATA:
    ---
    SAST / SECURITY SCANNING:
    {context_data}

    IDENTITY ANALYZER:
    {identity_context}

    SECRETS DETECTION (GITLEAKS):
    {gitleaks_context}
    ---

    RESPONSE GUIDELINES:
    1. Always refer to the identity module as "Identity Analyzer". Never use "Identity Risk Intelligence".
    2. Always refer to the secrets module as "Secrets Detection" or "Gitleaks". Treat exposed credentials as critical risks.
    3. If the user asks a specific question and the data is limited, summarize whatever IS available and provide general security best practices related to the topic.
    4. If no identities are found, suggest connecting a provider like AWS, GCP, or Okta in the Identity Analyzer settings.
    5. Be proactive: if you see exposed secrets, high risk scores, or low MFA coverage, mention them as priorities.
    6. Maintain a professional, confident, and helpful tone.
    7. Ensure you name platforms (AWS, Azure, Okta, etc.) explicitly and never refer to them as "demo" data.
    8. When secrets are found, always recommend rotating/revoking the exposed credentials immediately.
    """

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": query,
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.4, # Slightly higher for better summarization
            max_completion_tokens=1024,
        )
        
        return ChatResponse(response=chat_completion.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
