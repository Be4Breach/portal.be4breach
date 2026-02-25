from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
import os
from groq import Groq
import json
from app.database import scans_collection, findings_collection

router = APIRouter()

client = Groq(api_key=os.environ.get("GROQ_API_KEY", "default"))

class ChatRequest(BaseModel):
    query: str
    context_filters: Dict[str, Any] = {} # e.g., project_id, etc.

class ChatResponse(BaseModel):
    response: str

from app.auth import get_current_user

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

    system_prompt = f"""
    You are an AI Security Assistant for Be4Breach, an enterprise DevSecOps platform.
    Your goal is to answer user questions about their risk intelligence score, vulnerabilities, and general security posture.
    Use the following context data fetched from the database to answer the user's questions:
    
    {context_data}
    
    Be concise, helpful, and speak in a professional tone. If the context data doesn't contain the answer, say that you don't have enough information, but provide general security advice if applicable.
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
            temperature=0.3,
            max_completion_tokens=1024,
        )
        
        return ChatResponse(response=chat_completion.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
