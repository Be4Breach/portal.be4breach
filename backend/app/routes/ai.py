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

    system_prompt = f"""
    You are the "Identity Analyzer AI" for Be4Breach, an enterprise platform for DevSecOps and Identity Analyzer.
    Your objective is to provide professional, concise, and actionable security insights based on the context data provided.

    CONTEXT DATA:
    ---
    SECURITY SCANNING:
    {context_data}

    IDENTITY ANALYZER:
    {identity_context}
    ---

    RESPONSE GUIDELINES:
    1. Always refer to this module as "Identity Analyzer". Never use "Identity Risk Intelligence".
    2. If the user asks a specific question and the data is limited, summarize whatever IS available and provide general security best practices related to the topic.
    3. If no identities are found, suggest connecting a provider like AWS, GCP, or Okta in the Identity Analyzer settings.
    4. Be proactive: if you see high risk scores or low MFA coverage, mention them as priorities.
    5. Maintain a professional, confident, and helpful tone.
    6. Ensure you name platforms (AWS, Azure, Okta, etc.) explicitly and never refer to them as "demo" data.
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
