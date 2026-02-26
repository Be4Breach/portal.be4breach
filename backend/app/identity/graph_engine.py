"""
Identity Analyzer - Graph Engine
==========================================
Implements identity relationship modeling for:
- Privilege escalation path detection
- Lateral movement simulation
- Blast radius estimation
- Cross-cloud role correlation
"""

from typing import List, Dict, Set, Optional, Any, Tuple
from collections import defaultdict
import logging

from app.models import UnifiedIdentity, IdentitySource, PrivilegeTier

logger = logging.getLogger(__name__)

# ── Permission Weight Map ──────────────────────────────────────────────────────
# Approximate sensitivity of common IAM permissions

PERMISSION_WEIGHTS: Dict[str, float] = {
    "AdministratorAccess": 1.0,
    "SuperAdmin": 1.0,
    "Owner": 0.95,
    "GlobalAdmin": 0.95,
    "root": 1.0,
    "admin": 0.9,
    "Contributor": 0.6,
    "Editor": 0.6,
    "ReadWrite": 0.5,
    "Developer": 0.4,
    "Reader": 0.2,
    "Viewer": 0.1,
}


def _get_role_weight(role: str) -> float:
    """Get the sensitivity weight for a given role name."""
    for key, weight in PERMISSION_WEIGHTS.items():
        if key.lower() in role.lower():
            return weight
    if "admin" in role.lower():
        return 0.9
    if "write" in role.lower() or "manage" in role.lower():
        return 0.5
    if "read" in role.lower() or "view" in role.lower():
        return 0.15
    return 0.3


class IdentityGraphNode:
    """Represents a node in the identity relationship graph."""

    def __init__(self, identity: UnifiedIdentity):
        self.identity = identity
        self.edges: List["GraphEdge"] = []

    @property
    def id(self) -> str:
        return self.identity.id

    @property
    def email(self) -> str:
        return self.identity.email


class GraphEdge:
    """Represents a relationship between two identity nodes."""

    def __init__(
        self,
        source: str,
        target: str,
        relationship: str,
        weight: float = 1.0
    ):
        self.source = source
        self.target = target
        self.relationship = relationship
        self.weight = weight


class IdentityGraph:
    """
    In-memory identity relationship graph.
    Models: User → Roles → Groups → Permissions → Resources
    Used for path analysis, blast radius, and privilege escalation detection.
    """

    def __init__(self, identities: List[UnifiedIdentity]):
        self.nodes: Dict[str, IdentityGraphNode] = {}
        self.adjacency: Dict[str, List[Tuple[str, str, float]]] = defaultdict(list)
        self._email_to_ids: Dict[str, List[str]] = defaultdict(list)
        self._build_graph(identities)

    def _build_graph(self, identities: List[UnifiedIdentity]):
        """Build the identity relationship graph from identity data."""
        for identity in identities:
            node = IdentityGraphNode(identity)
            self.nodes[identity.id] = node
            email = identity.email.lower()
            self._email_to_ids[email].append(identity.id)

        # Build cross-provider edges (same email across providers)
        for email, ids in self._email_to_ids.items():
            if len(ids) > 1:
                for i in range(len(ids)):
                    for j in range(i + 1, len(ids)):
                        self._add_edge(ids[i], ids[j], "cross_provider", 0.8)

        # Build linked account edges
        for identity in identities:
            for linked in identity.linkedAccounts:
                if linked in self.nodes:
                    self._add_edge(identity.id, linked, "linked_account", 0.9)

        # Build group membership edges (using virtual nodes for efficiency)
        for identity in identities:
            for group in identity.groupMembership:
                vnode_id = f"vgroup:{group}"
                self._add_edge(identity.id, vnode_id, "member_of", 0.5)

        # Build role-similarity edges (using virtual nodes for efficiency)
        for identity in identities:
            for role in identity.roles:
                weight = _get_role_weight(role)
                if weight >= 0.7:
                    vnode_id = f"vrole:{role}"
                    self._add_edge(identity.id, vnode_id, "has_role", weight * 0.5)

        logger.info(
            f"Identity graph built: {len(self.nodes)} nodes (plus virtual nodes), "
            f"edges created."
        )

    def _add_edge(self, source: str, target: str, relationship: str, weight: float):
        """Add a bidirectional edge to the graph."""
        self.adjacency[source].append((target, relationship, weight))
        self.adjacency[target].append((source, relationship, weight))

    # ── Traversal Methods ──────────────────────────────────────────────────────

    def get_connected_identities(self, identity_id: str, max_depth: int = 3) -> List[Dict[str, Any]]:
        """BFS to find all identities reachable from a given identity."""
        if identity_id not in self.nodes:
            return []

        visited: Set[str] = {identity_id}
        queue: List[Tuple[str, int, str]] = [(identity_id, 0, "origin")]
        result: List[Dict[str, Any]] = []

        while queue:
            current, depth, via = queue.pop(0)
            if depth > 0:
                node = self.nodes.get(current)
                if node:
                    result.append({
                        "id": current,
                        "email": node.email,
                        "source": node.identity.provider if node.identity.source == IdentitySource.DEMO else node.identity.source.value,
                        "depth": depth,
                        "via": via,
                        "riskScore": node.identity.riskScore,
                    })

            if depth < max_depth:
                for neighbor, rel, weight in self.adjacency.get(current, []):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        # Skip virtual nodes in the final result list
                        if neighbor.startswith("vgroup:") or neighbor.startswith("vrole:"):
                             queue.append((neighbor, depth, via)) # Don't increase depth for virtual nodes if they are just connectors? 
                             # Actually let's just make virtual nodes count as a hop but skip them in results.
                             # Or better yet, virtual nodes don't count as a hop for 'depth' if we want to show real identity hops.
                        else:
                             queue.append((neighbor, depth + 1, rel))

        return result

    def find_admin_takeover_paths(self, start_id: str) -> List[List[Dict[str, Any]]]:
        """Find paths from a non-admin identity to admin identities."""
        start_node = self.nodes.get(start_id)
        if not start_node:
            return []

        # Find admin nodes
        admin_ids = set()
        for nid, node in self.nodes.items():
            if any("admin" in r.lower() for r in node.identity.roles):
                admin_ids.add(nid)

        if start_id in admin_ids:
            return []  # Already admin

        paths = []
        self._dfs_paths(start_id, admin_ids, [], set(), paths, max_depth=4)
        return paths

    def _dfs_paths(
        self,
        current: str,
        targets: Set[str],
        path: List[Dict[str, Any]],
        visited: Set[str],
        all_paths: List[List[Dict[str, Any]]],
        max_depth: int
    ):
        """DFS to find all paths to target nodes."""
        if len(path) > max_depth:
            return
        if current in targets and len(path) > 0:
            all_paths.append(list(path))
            return

        visited.add(current)
        for neighbor, rel, weight in self.adjacency.get(current, []):
            if neighbor not in visited:
                node = self.nodes.get(neighbor)
                if node:
                    path.append({
                        "id": neighbor,
                        "email": node.email,
                        "relationship": rel,
                        "weight": weight,
                    })
                    self._dfs_paths(neighbor, targets, path, visited, all_paths, max_depth)
                    path.pop()
        visited.discard(current)

    def calculate_blast_radius(self, identity_id: str) -> Dict[str, Any]:
        """Estimate the blast radius if this identity is compromised."""
        connected = self.get_connected_identities(identity_id, max_depth=3)
        node = self.nodes.get(identity_id)

        if not node:
            return {"identityId": identity_id, "blastRadius": 0, "affectedIdentities": 0}

        # Calculate weighted blast radius
        total_weight = 0
        affected_sources: Set[str] = set()
        admin_reachable = 0

        for conn in connected:
            depth_factor = 1.0 / (conn["depth"] + 1)
            total_weight += depth_factor
            affected_sources.add(conn["source"])
            if any("admin" in r.lower() for r in self.nodes[conn["id"]].identity.roles):
                admin_reachable += 1

        # Amplify blast radius for identities that can reach admins
        admin_multiplier = 1.0 + (admin_reachable * 0.3)
        cross_cloud_multiplier = 1.0 + (len(affected_sources) * 0.15)

        raw_blast = total_weight * admin_multiplier * cross_cloud_multiplier
        blast_radius = min(int(raw_blast * 10), 100)

        return {
            "identityId": identity_id,
            "blastRadius": blast_radius,
            "affectedIdentities": len(connected),
            "affectedSources": list(affected_sources),
            "adminReachable": admin_reachable,
            "crossCloudSpread": len(affected_sources),
        }

    def detect_lateral_movement_paths(self, identity_id: str) -> List[Dict[str, Any]]:
        """Detect potential lateral movement paths from an identity."""
        connected = self.get_connected_identities(identity_id, max_depth=4)

        paths = []
        node = self.nodes.get(identity_id)
        if not node:
            return paths

        start_source = node.identity.provider if node.identity.source == IdentitySource.DEMO else node.identity.source.value

        for conn in connected:
            # Lateral movement is particularly interesting when moving between sources
            # or jumping across high-privilege accounts
            if conn["source"] != start_source or conn["riskScore"] > 50:
                paths.append({
                    "from": {"id": identity_id, "source": start_source, "email": node.email},
                    "to": {"id": conn["id"], "source": conn["source"], "email": conn["email"]},
                    "hops": conn["depth"],
                    "via": conn["via"],
                    "risk": conn["riskScore"],
                    "critical": conn["riskScore"] >= 80
                })

        paths.sort(key=lambda x: (not x["critical"], x["hops"]))
        return paths[:15]

    def get_risk_distribution(self) -> Dict[str, int]:
        """Get counts of identities by risk level."""
        dist = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
        for identity in self.identities:
            if identity.riskScore >= 80: dist["Critical"] += 1
            elif identity.riskScore >= 50: dist["High"] += 1
            elif identity.riskScore >= 20: dist["Medium"] += 1
            else: dist["Low"] += 1
        return dist


# ── Enhanced Risk Engine ───────────────────────────────────────────────────────

class EnhancedRiskEngine:
    """
    Advanced risk scoring engine using graph-based analysis.
    Extends the base IdentityRiskEngine with graph modeling.
    """

    FACTOR_NO_MFA = 30
    FACTOR_ADMIN_ROLE = 25
    FACTOR_ORPHANED = 20
    FACTOR_INACTIVE_90D = 15
    FACTOR_PRIVILEGE_ESCALATION = 20
    FACTOR_DUPLICATE_IDENTITY = 10
    FACTOR_ROLE_DRIFT = 15
    FACTOR_MFA_INCONSISTENCY = 15
    FACTOR_UNLINKED_SAAS = 15

    def __init__(self, identities: List[UnifiedIdentity]):
        self.identities = identities
        self.graph = IdentityGraph(identities)
        self._email_map: Dict[str, List[UnifiedIdentity]] = defaultdict(list)
        for i in identities:
            self._email_map[i.email.lower()].append(i)

    def calculate_privilege_tier(self, identity: UnifiedIdentity) -> PrivilegeTier:
        """Determine the privilege tier of an identity."""
        max_weight = max((_get_role_weight(r) for r in identity.roles), default=0)
        
        # Consider graph-based privilege (reachability to admins)
        blast = self.graph.calculate_blast_radius(identity.id)
        if blast["adminReachable"] > 3 or max_weight >= 0.9:
            return PrivilegeTier.CRITICAL
        if blast["adminReachable"] > 0 or max_weight >= 0.6:
            return PrivilegeTier.HIGH
        if max_weight >= 0.3:
            return PrivilegeTier.MEDIUM
        return PrivilegeTier.LOW

    def calculate_exposure_level(self, identity: UnifiedIdentity) -> float:
        """Calculate how exposed an identity is (0-100)."""
        exposure = 0.0
        if not identity.mfaEnabled:
            exposure += 35
        if any("admin" in r.lower() for r in identity.roles):
            exposure += 25
        
        # Linked accounts increase exposure
        related = self._email_map.get(identity.email.lower(), [])
        exposure += min(len(related) * 10, 30)
        
        # Blast radius contribution to exposure
        blast = self.graph.calculate_blast_radius(identity.id)
        exposure += (blast["blastRadius"] / 100) * 10
        
        return min(exposure, 100)

    def process_all_enhanced(self) -> List[Dict[str, Any]]:
        """Process all identities with graph-enhanced risk analysis."""
        results = []
        for identity in self.identities:
            blast = self.graph.calculate_blast_radius(identity.id)
            attack_paths = self.graph.find_admin_takeover_paths(identity.id)
            tier = self.calculate_privilege_tier(identity)
            exposure = self.calculate_exposure_level(identity)

            # Update identity with computed fields
            identity.privilegeTier = tier
            identity.exposureLevel = exposure
            identity.attackPathCount = len(attack_paths)
            identity.blastRadius = blast["blastRadius"]

            # Get cross-cloud accounts
            related = self._email_map.get(identity.email.lower(), [])
            identity.cloudAccounts = list({
                (i.provider if i.source == IdentitySource.DEMO else i.source.value) 
                for i in related 
                if (i.provider if i.source == IdentitySource.DEMO else i.source.value) in {"aws", "azure", "gcp"}
            })

            results.append({
                "identity": identity,
                "blastRadius": blast,
                "attackPaths": attack_paths[:5],
                "privilegeTier": tier.value,
                "exposureLevel": exposure,
            })

        return results

    def get_global_risk_score(self) -> Dict[str, Any]:
        """Calculate the global identity risk score (0-100)."""
        if not self.identities:
            return {"score": 0, "level": "Low", "breakdown": {}}

        total_risk = sum(i.riskScore for i in self.identities)
        avg_risk = total_risk / len(self.identities) if self.identities else 0

        no_mfa_count = sum(1 for i in self.identities if not i.mfaEnabled)
        admin_count = sum(1 for i in self.identities if any("admin" in r.lower() for r in i.roles))
        critical_count = sum(1 for i in self.identities if i.riskScore >= 80)
        
        # Identity sprawl factor
        total_linked = sum(len(i.linkedAccounts) for i in self.identities)
        sprawl_factor = (total_linked / max(len(self.identities), 1)) * 5

        # Weighted global score
        mfa_factor = (no_mfa_count / max(len(self.identities), 1)) * 30
        admin_factor = (admin_count / max(len(self.identities), 1)) * 20
        critical_factor = (critical_count / max(len(self.identities), 1)) * 25
        base_score = avg_risk * 0.2

        score = min(base_score + mfa_factor + admin_factor + critical_factor + sprawl_factor, 100)

        level = "Low"
        if score >= 81: level = "Critical"
        elif score >= 61: level = "High"
        elif score >= 31: level = "Medium"

        return {
            "score": round(score, 1),
            "level": level,
            "breakdown": {
                "avgUserRisk": round(avg_risk, 1),
                "mfaCoverage": round(100 - (no_mfa_count / max(len(self.identities), 1) * 100), 1),
                "privilegedRatio": round(admin_count / max(len(self.identities), 1) * 100, 1),
                "criticalUsers": critical_count,
            }
        }

    def get_breach_probability(self) -> Dict[str, Any]:
        """Estimate breach probability using optimized multi-source BFS."""
        if not self.identities:
            return {"probability": 0, "totalPaths": 0, "highRiskPaths": 0}

        # Identify all admin nodes
        admin_ids = [nid for nid, node in self.graph.nodes.items() 
                     if any("admin" in r.lower() for r in node.identity.roles)]
        
        # Multi-source BFS from all admins simultaneously
        # finds shortest distance to any admin for all nodes
        distances = {aid: 0 for aid in admin_ids}
        queue = list(admin_ids)
        
        while queue:
            current = queue.pop(0)
            dist = distances[current]
            if dist >= 4: continue # Bound search
            
            for neighbor, rel, weight in self.graph.adjacency.get(current, []):
                if neighbor not in distances:
                    distances[neighbor] = dist + 1
                    queue.append(neighbor)

        # Count nodes that can reach admin in few hops
        high_risk_paths = sum(1 for nid, d in distances.items() if 1 <= d <= 2 and not nid.startswith("v"))
        total_reachable = sum(1 for nid, d in distances.items() if d > 0 and not nid.startswith("v"))

        # Factor in MFA gaps
        no_mfa = sum(1 for i in self.identities if not i.mfaEnabled)
        mfa_gap = no_mfa / max(len(self.identities), 1)

        prob = min(
            (high_risk_paths * 15 + total_reachable * 1.5) / max(len(self.identities), 1) * 10
            + mfa_gap * 45,
            98
        )

        return {
            "probability": round(prob, 1),
            "totalPaths": total_reachable,
            "highRiskPaths": high_risk_paths,
            "mfaGapFactor": round(mfa_gap * 100, 1),
        }

    def get_mfa_coverage(self) -> Dict[str, Any]:
        """Calculate MFA enforcement coverage across providers."""
        if not self.identities:
            return {"coverage": 0, "byProvider": {}}

        provider_stats: Dict[str, Dict[str, int]] = defaultdict(lambda: {"total": 0, "mfa": 0})
        for i in self.identities:
            src = i.provider if i.source == IdentitySource.DEMO else i.source.value
            provider_stats[src]["total"] += 1
            if i.mfaEnabled:
                provider_stats[src]["mfa"] += 1

        total_mfa = sum(1 for i in self.identities if i.mfaEnabled)
        coverage = (total_mfa / max(len(self.identities), 1)) * 100

        by_provider = {}
        for src, stats in provider_stats.items():
            by_provider[src] = round((stats["mfa"] / max(stats["total"], 1)) * 100, 1)

        return {
            "coverage": round(coverage, 1),
            "totalWithMFA": total_mfa,
            "totalWithoutMFA": len(self.identities) - total_mfa,
            "byProvider": by_provider,
        }
