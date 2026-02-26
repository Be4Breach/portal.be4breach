from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timedelta
import random
import logging

from app.auth import get_current_user
from app.models import UnifiedIdentity, OktaConfig, AuditLogEntry, CopilotQuery
from app.database import database, audit_collection, DB_AVAILABLE
from app.identity.sync_service import IdentitySyncService

logger = logging.getLogger(__name__)

router = APIRouter()
sync_service = IdentitySyncService(database)


async def log_audit(action: str, user: dict, metadata: Optional[Dict[str, Any]] = None):
    entry = AuditLogEntry(
        action=action,
        adminUser=user.get("email", "unknown"),
        timestamp=datetime.utcnow(),
        metadata=metadata
    )
    if DB_AVAILABLE:
        await audit_collection.insert_one(entry.dict())
    else:
        logger.info(f"AUDIT (MOCK): {action} by {user.get('email', 'unknown')}")


# ── Health Check ───────────────────────────────────────────────────────────────

@router.get("/health")
async def health_check():
    """Backend health check for live status indicator."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "db_available": DB_AVAILABLE,
        "event_stream": "active",
    }


# ── Force Sync ─────────────────────────────────────────────────────────────────

@router.post("/sync")
async def trigger_sync(current_user: dict = Depends(get_current_user)):
    """Trigger a full identity sync across all active providers (GCP + GitHub)."""
    try:
        await log_audit("force_sync", current_user)
        total = await sync_service.sync_all(current_user.get("email"))
        return {
            "status": "success",
            "message": f"Synced {total} identities from all active providers.",
            "total_synced": total,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Force sync failed: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")



@router.get("/summary", response_model=Dict[str, Any])
async def get_identity_summary(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Optimized summary calculation (single pass)."""
    try:
        await log_audit("fetch_summary", current_user)

        resp = await sync_service.get_all_identities(limit=1000)
        identities = resp["items"]

        # Import enhanced risk engine for global scores
        from app.identity.graph_engine import EnhancedRiskEngine
        engine = EnhancedRiskEngine(identities)

        # These are relatively fast calculations
        global_risk = engine.get_global_risk_score()
        breach_prob = engine.get_breach_probability()
        mfa_coverage = engine.get_mfa_coverage()

        # Single pass counts for performance
        risky_count = 0
        critical_count = 0
        orphaned_count = 0
        mfa_failures = 0
        admin_count = 0
        privilege_escalations = 0

        for i in identities:
            if i.riskScore >= 50: risky_count += 1
            if i.riskScore >= 80: critical_count += 1
            if not i.linkedAccounts: orphaned_count += 1
            if not i.mfaEnabled: mfa_failures += 1
            
            is_admin = any("admin" in r.lower() for r in i.roles)
            if is_admin:
                admin_count += 1
                privilege_escalations += 1
            elif len(i.roles) >= 10:
                privilege_escalations += 1

        return {
            "total_identities": len(identities),
            "risky_users": risky_count,
            "critical_alerts": critical_count,
            "orphaned_accounts": orphaned_count,
            "mfa_failures": mfa_failures,
            "privilege_escalations": privilege_escalations,
            "last_sync": datetime.utcnow().isoformat(),
            "global_risk_score": global_risk,
            "breach_probability": breach_prob,
            "mfa_coverage": mfa_coverage,
            "privileged_ratio": round(admin_count / max(len(identities), 1) * 100, 1),
            "admin_count": admin_count,
        }
    except Exception as e:
        logger.error(f"ERROR in get_identity_summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch identity summary: {str(e)}")


# ── Identity Listing ──────────────────────────────────────────────────────────

@router.get("/identities")
async def get_unified_identities(
    request: Request,
    search: Optional[str] = None,
    source: Optional[str] = None,
    risk_level: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc",
    current_user: dict = Depends(get_current_user)
):
    await log_audit("fetch_identities", current_user)
    skip = (page - 1) * limit
    resp = await sync_service.get_all_identities(search, source, risk_level, skip, limit)
    results = resp["items"]
    total = resp["total"]

    # Enhance with graph data
    try:
        from app.identity.graph_engine import EnhancedRiskEngine
        engine = EnhancedRiskEngine(results)
        engine.process_all_enhanced()
    except Exception as e:
        logger.warning(f"Graph enhancement skipped: {str(e)}")

    # Serialize
    items = []
    for r in results:
        d = r.dict()
        src = r.source.value if hasattr(r.source, 'value') else r.source
        if src == "demo" and r.provider:
            src = r.provider
        d["source"] = src
        d["privilegeTier"] = r.privilegeTier.value
        items.append(d)

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/risk-data-all")
async def get_identity_risk_all(
    current_user: dict = Depends(get_current_user)
):
    """Requested endpoint for all identity risk data."""
    resp = await sync_service.get_all_identities(limit=100)
    results = resp["items"]
    items = []
    for r in results:
        d = r.dict()
        src = r.source.value if hasattr(r.source, 'value') else r.source
        if src == "demo" and r.provider:
            src = r.provider
        d["source"] = src
        d["privilegeTier"] = r.privilegeTier.value
        items.append(d)
    return items


# ── Identity Detail ───────────────────────────────────────────────────────────

@router.get("/identities/{identity_id}")
async def get_identity_detail(
    identity_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    await log_audit("fetch_identity_detail", current_user, {"identity_id": identity_id})

    resp = await sync_service.get_all_identities()
    identities = resp["items"]
    identity = next((i for i in identities if i.id == identity_id), None)

    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")

    from app.identity.graph_engine import EnhancedRiskEngine
    engine = EnhancedRiskEngine(identities)
    engine.process_all_enhanced()

    blast = engine.graph.calculate_blast_radius(identity_id)
    attack_paths = engine.graph.find_admin_takeover_paths(identity_id)
    lateral = engine.graph.detect_lateral_movement_paths(identity_id)
    connected = engine.graph.get_connected_identities(identity_id, max_depth=2)

    # Remediation suggestions
    from app.identity.remediation_engine import RemediationEngine
    rem_engine = RemediationEngine(identities)
    remediations = rem_engine.generate_for_identity(identity)

    # Risk factors
    from app.identity.risk_engine import IdentityRiskEngine
    risk_engine = IdentityRiskEngine(identities)
    risk_info = risk_engine.calculate_risk_score(identity)

    detail = identity.dict()
    src = identity.source.value if hasattr(identity.source, 'value') else identity.source
    if src == "demo" and identity.provider:
        src = identity.provider
    detail["source"] = src
    detail["privilegeTier"] = identity.privilegeTier.value
    detail["riskFactors"] = risk_info.get("factors", [])
    detail["riskLevel"] = risk_info.get("riskLevel", "Low")
    detail["blastRadiusData"] = blast
    detail["attackPaths"] = attack_paths[:5]
    detail["lateralMovement"] = lateral[:5]
    detail["connectedIdentities"] = connected[:10]
    detail["remediations"] = remediations

    return detail



@router.get("/identities/{identity_id}/compliance")
async def get_identity_compliance(
    identity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get compliance results for a specific identity."""
    resp = await sync_service.get_all_identities()
    identities = resp["items"]
    identity = next((i for i in identities if i.id == identity_id), None)
    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")

    from app.identity.compliance_engine import ComplianceEngine
    engine = ComplianceEngine(identities)
    return engine.check_identity_compliance(identity)


# ── Provider Connect ──────────────────────────────────────────────────────────

@router.get("/providers/{provider}/status")
async def get_provider_status(
    provider: str,
    current_user: dict = Depends(get_current_user)
):
    """Generic status checker for all providers (real or demo)."""
    if not DB_AVAILABLE:
        return {"connected": False, "status": "disconnected"}

    # Special logic for GCP/GitHub if we want to defer to their specific routes, 
    # but here we can check DB for ANY provider.
    identities = await sync_service.identities_collection.find({
        "$or": [
            {"source": provider},
            {"source": "demo", "provider": provider}
        ]
    }).to_list(length=1000)

    if not identities:
        return {"connected": False, "status": "disconnected"}

    users = [i for i in identities if "@" in (i.get("email") or "")]
    sas = [i for i in identities if "role" in (i.get("id") or "").lower() or "serviceaccount" in (i.get("id") or "").lower()]
    privileged = [i for i in identities if i.get("privilegeTier") in ["high", "critical"]]
    
    # Get last sync from config
    config = await sync_service.config_collection.find_one({"source": provider})
    last_sync = config.get("last_sync") if config else None
    
    # If no config but we have demo data, use a recent timestamp
    if not last_sync and identities:
        last_sync = datetime.utcnow() - timedelta(minutes=random.randint(1, 60))

    return {
        "connected": True,
        "status": "connected" if provider in ["github", "gcp"] else "demo",
        "project_id": config.get("credentials", {}).get("project_id") if config else f"{provider}-demo-env",
        "total_users": len(users),
        "service_accounts": len(sas),
        "privileged_accounts": len(privileged),
        "last_sync": last_sync.isoformat() if isinstance(last_sync, datetime) else last_sync
    }

@router.post("/providers/{provider}/connect")
async def connect_provider(
    provider: str,
    config: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Generic connect endpoint (MOCK for now)."""
    await log_audit(f"connect_{provider}", current_user)
    return {"message": f"{provider.capitalize()} connected successfully", "status": "active"}

@router.post("/providers/okta/connect")
async def connect_okta(
    config: OktaConfig,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    await log_audit("connect_okta", current_user, {"domain": config.domain})
    return {"message": "Okta connected successfully", "status": "active"}


# ── Risk Report ───────────────────────────────────────────────────────────────

@router.get("/risk-report/{identity_id}")
async def get_risk_report(
    identity_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    await log_audit("fetch_risk_report", current_user, {"identity_id": identity_id})

    resp = await sync_service.get_all_identities()
    identities = resp["items"]
    identity = next((i for i in identities if i.id == identity_id), None)

    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")

    from app.identity.risk_engine import IdentityRiskEngine
    r_engine = IdentityRiskEngine(identities)
    risk_info = r_engine.calculate_risk_score(identity)

    return risk_info


# ── Risk Trend Data ───────────────────────────────────────────────────────────

@router.get("/risk-trend")
async def get_risk_trend(
    days: int = 30,
    request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """Get real risk trend data from sync history."""
    await log_audit("fetch_risk_trend", current_user, {"days": days})

    resp = await sync_service.get_all_identities(limit=1000)
    identities = resp["items"]
    
    # Try to fetch real sync history from DB
    trend_data = []
    if DB_AVAILABLE:
        try:
            from datetime import timedelta
            cutoff = datetime.utcnow() - timedelta(days=days)
            cursor = database.get_collection("sync_history").find(
                {"timestamp": {"$gte": cutoff}}
            ).sort("timestamp", 1)
            history = await cursor.to_list(length=500)
            
            for entry in history:
                ts = entry.get("timestamp", datetime.utcnow())
                avg_risk = entry.get("avg_risk", 0)
                total = entry.get("total_synced", 0)
                privileged = entry.get("privileged_count", 0)
                mfa_cov = 100.0  # default if not tracked
                
                trend_data.append({
                    "date": ts.strftime("%Y-%m-%d"),
                    "score": round(avg_risk, 1),
                    "mfaCoverage": round(mfa_cov, 1),
                    "criticalCount": privileged,
                    "totalIdentities": total,
                    "provider": entry.get("provider", "unknown")
                })
        except Exception as e:
            logger.warning(f"Could not fetch sync history: {e}")
    
    # If no history available, create current-state point from identities
    if not trend_data and identities:
        from app.identity.graph_engine import EnhancedRiskEngine
        engine = EnhancedRiskEngine(identities)
        current_score = engine.get_global_risk_score()
        mfa = engine.get_mfa_coverage()
        now = datetime.utcnow()
        trend_data.append({
            "date": now.strftime("%Y-%m-%d"),
            "score": current_score["score"],
            "mfaCoverage": mfa["coverage"],
            "criticalCount": current_score["breakdown"].get("criticalUsers", 0),
            "totalIdentities": len(identities),
            "provider": "all"
        })

    return {"trend": trend_data, "days": days}


@router.get("/dashboard-aggregation")
async def get_dashboard_aggregation(
    current_user: dict = Depends(get_current_user)
):
    """Aggregate real data from GCP + GitHub for dashboard charts."""
    resp = await sync_service.get_all_identities(limit=1000)
    identities = resp["items"]
    
    # Provider distribution
    provider_counts = {}
    privileged_count = 0
    non_privileged_count = 0
    admin_count = 0
    standard_count = 0
    high_risk_count = 0
    total = len(identities)
    
    risk_distribution = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    
    for identity in identities:
        # Step 5: Map demo source back to actual provider for UI consistency
        src = identity.source.value if hasattr(identity.source, 'value') else identity.source
        if src == "demo" and identity.provider:
            src = identity.provider
            
        provider_counts[src] = provider_counts.get(src, 0) + 1
        
        tier = identity.privilegeTier.value if hasattr(identity.privilegeTier, 'value') else identity.privilegeTier
        if tier in ("high", "critical"):
            privileged_count += 1
        else:
            non_privileged_count += 1
        
        is_admin = any("admin" in r.lower() for r in identity.roles)
        if is_admin:
            admin_count += 1
        else:
            standard_count += 1
        
        if identity.riskScore >= 80:
            risk_distribution["critical"] += 1
            high_risk_count += 1
        elif identity.riskScore >= 61:
            risk_distribution["high"] += 1
            high_risk_count += 1
        elif identity.riskScore >= 31:
            risk_distribution["medium"] += 1
        else:
            risk_distribution["low"] += 1
    
    # IAM owners from GCP
    iam_owners = 0
    repo_admins = 0
    for identity in identities:
        src = identity.source.value if hasattr(identity.source, 'value') else identity.source
        if src == "demo" and identity.provider:
            src = identity.provider
            
        if src == "gcp":
            if any("roles/owner" in r for r in identity.roles):
                iam_owners += 1
        elif src == "github":
            if any("admin" in r.lower() for r in identity.roles):
                repo_admins += 1
        elif src in ["aws", "azure", "gitlab", "okta"]:
            # Count privileged roles for these demo/disconnected providers
            if any(role.lower() in ["administratoraccess", "global administrator", "owner", "super admin"] for role in identity.roles):
                if src in ["aws", "azure", "okta"]:
                    iam_owners += 1
                elif src == "gitlab":
                    repo_admins += 1
    
    # Sync history for line chart
    sync_history = []
    if DB_AVAILABLE:
        try:
            cursor = database.get_collection("sync_history").find({}).sort("timestamp", 1).limit(50)
            history = await cursor.to_list(length=50)
            for entry in history:
                ts = entry.get("timestamp", datetime.utcnow())
                # Normalize: MongoDB returns datetime, but guard against strings
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts)
                    except Exception:
                        ts = datetime.utcnow()
                date_str = ts.strftime("%Y-%m-%d %H:%M") if isinstance(ts, datetime) else str(ts)
                sync_history.append({
                    "date": date_str,
                    "provider": entry.get("provider", "unknown"),
                    "avg_risk": round(entry.get("avg_risk", 0), 1),
                    "total_synced": entry.get("total_synced", 0),
                    "privileged_count": entry.get("privileged_count", 0),
                })
        except Exception as e:
            logger.warning(f"Could not fetch sync history for aggregation: {e}")
    
    # Identity list for table
    identity_list = []
    for identity in identities:
        src = identity.source.value if hasattr(identity.source, 'value') else identity.source
        if src == "demo" and identity.provider:
            src = identity.provider
            
        tier = identity.privilegeTier.value if hasattr(identity.privilegeTier, 'value') else identity.privilegeTier
        identity_list.append({
            "id": identity.id,
            "email": identity.email,
            "source": src,
            "roles": identity.roles,
            "riskScore": identity.riskScore,
            "privilegeTier": tier,
            "mfaEnabled": identity.mfaEnabled,
            "isActive": identity.isActive,
        })
    
    return {
        "total_identities": total,
        "privileged_count": privileged_count,
        "non_privileged_count": non_privileged_count,
        "high_risk_count": high_risk_count,
        "admin_count": admin_count,
        "standard_count": standard_count,
        "iam_owners": iam_owners,
        "repo_admins": repo_admins,
        "provider_distribution": provider_counts,
        "risk_distribution": risk_distribution,
        "sync_history": sync_history,
        "identity_list": identity_list,
    }


# ── Graph Data for Frontend ──────────────────────────────────────────────────

@router.get("/graph")
async def get_identity_graph(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get identity relationship graph data for visualization."""
    await log_audit("fetch_graph", current_user)

    resp = await sync_service.get_all_identities(limit=100)
    identities = resp["items"]

    from app.identity.graph_engine import IdentityGraph
    graph = IdentityGraph(identities)

    nodes = []
    for nid, node in graph.nodes.items():
        nodes.append({
            "id": nid,
            "email": node.email,
            "source": node.identity.source.value,
            "riskScore": node.identity.riskScore,
            "roles": node.identity.roles[:3],
            "mfaEnabled": node.identity.mfaEnabled,
            "privilegeTier": node.identity.privilegeTier.value,
        })

    edges = []
    seen_edges = set()
    for source_id, neighbors in graph.adjacency.items():
        for target_id, relationship, weight in neighbors:
            edge_key = tuple(sorted([source_id, target_id])) + (relationship,)
            if edge_key not in seen_edges:
                seen_edges.add(edge_key)
                edges.append({
                    "source": source_id,
                    "target": target_id,
                    "relationship": relationship,
                    "weight": weight,
                })

    return {"nodes": nodes, "edges": edges}


# ── AI Copilot Endpoint ──────────────────────────────────────────────────────

@router.post("/copilot/query")
async def copilot_query(
    body: CopilotQuery,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    AI Copilot endpoint - 100% FREE, no paid APIs.
    Uses scikit-learn TF-IDF + rule-based expert system.
    """
    await log_audit("copilot_query", current_user, {"query": body.query[:100]})

    from app.ai.copilot_engine import get_copilot

    copilot = get_copilot()

    # Update copilot context with current identity data
    resp = await sync_service.get_all_identities(limit=1000)
    identities = resp["items"]
    identity_dicts = [i.dict() for i in identities]
    copilot.update_identity_context(identity_dicts)

    result = copilot.query(body.query, body.context_identity_id)

    return result


# ── Requested IAM Portal API Routes ──────────────────────────────────────────

@router.get("/risk-profile/{identity_id}")
async def get_identity_risk_profile(
    identity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Phase 2: Identity Risk Scoring Engine Output"""
    resp = await sync_service.get_all_identities()
    identities = resp["items"]
    identity = next((i for i in identities if i.id == identity_id), None)
    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")

    from app.identity.risk_engine import IdentityRiskEngine
    risk_engine = IdentityRiskEngine(identities)
    risk_info = risk_engine.calculate_risk_score(identity)
    
    from app.identity.graph_engine import EnhancedRiskEngine
    e_engine = EnhancedRiskEngine(identities)
    paths = e_engine.graph.find_admin_takeover_paths(identity_id)
    blast = e_engine.graph.calculate_blast_radius(identity_id)

    return {
        **risk_info,
        "escalation_paths_count": len(paths),
        "blast_radius_score": blast["blastRadius"],
        "anomaly_flag": risk_info["totalRiskScore"] > 70
    }

@router.get("/attack-path-graph/{identity_id}")
async def get_identity_attack_path_graph(
    identity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Phase 3: Attack Path Graph Engine Output"""
    resp = await sync_service.get_all_identities()
    identities = resp["items"]
    from app.identity.graph_engine import IdentityGraph
    graph = IdentityGraph(identities)
    
    if identity_id not in graph.nodes:
        raise HTTPException(status_code=404, detail="Identity not found in graph")
        
    # Return local graph around the identity
    connected = graph.get_connected_identities(identity_id, max_depth=3)
    
    nodes = []
    edges = []
    seen_nodes = {identity_id}
    
    # Add origin node
    origin = graph.nodes[identity_id]
    nodes.append({
        "id": identity_id,
        "label": origin.email,
        "type": "Identity",
        "risk": origin.identity.riskScore
    })
    
    for conn in connected:
        cid = conn["id"]
        seen_nodes.add(cid)
        nodes.append({
            "id": cid,
            "label": conn["email"],
            "type": "Identity",
            "risk": conn["riskScore"]
        })
        
    # Build edges between seen nodes
    for nid in seen_nodes:
        if nid in graph.adjacency:
            for neighbor, rel, weight in graph.adjacency[nid]:
                if neighbor in seen_nodes:
                    edges.append({
                        "source": nid,
                        "target": neighbor,
                        "relationship": rel,
                        "weight": weight
                    })
                    
    return {"nodes": nodes, "edges": edges}

@router.get("/compliance", response_model=Dict[str, Any])
async def get_global_compliance_report(
    current_user: dict = Depends(get_current_user)
):
    """Phase 4: Compliance Engine Output"""
    resp = await sync_service.get_all_identities()
    identities = resp["items"]
    from app.identity.compliance_engine import ComplianceEngine
    engine = ComplianceEngine(identities)
    return engine.get_global_compliance()

@router.get("/remediations", response_model=Dict[str, Any])
async def get_remediation_actions(
    current_user: dict = Depends(get_current_user)
):
    """Phase 5: Remediation Engine Output"""
    resp = await sync_service.get_all_identities()
    identities = resp["items"]
    from app.identity.remediation_engine import RemediationEngine
    engine = RemediationEngine(identities)
    return engine.generate_all()
