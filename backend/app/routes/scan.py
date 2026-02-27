import asyncio
import os
import sys
import json
import shutil
import tempfile
import subprocess
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from app.auth import get_current_user
from app.database import scans_collection, findings_collection

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── Binary resolution ────────────────────────────────────────────────────────

def _semgrep_bin() -> str:
    venv_bin = Path(sys.executable).parent / "semgrep"
    if sys.platform == "win32":
        venv_bin = venv_bin.with_suffix(".exe")
    if venv_bin.exists():
        return str(venv_bin)
    found = shutil.which("semgrep")
    if found:
        return found
    raise FileNotFoundError("semgrep not found. Install it with: pip install semgrep")


def _gitleaks_bin() -> Optional[str]:
    """
    Resolve gitleaks binary path.
    Checks PATH first, then falls back to well-known install locations so the
    binary is found even when Python/uvicorn didn't inherit the updated PATH
    (common after a winget install on Windows without restarting the terminal).
    """
    # 1. Check PATH first (Linux/EC2 will resolve here)
    found = shutil.which("gitleaks")
    if found:
        return found

    # 2. Windows fallback — winget default install location
    if sys.platform == "win32":
        win_candidates = [
            r"C:\Program Files\gitleaks\gitleaks.exe",
            r"C:\Program Files (x86)\gitleaks\gitleaks.exe",
        ]
        for path in win_candidates:
            if os.path.isfile(path):
                return path

    # 3. Linux / EC2 common install paths
    for candidate in [
        "/usr/local/bin/gitleaks",
        "/usr/bin/gitleaks",
        "/opt/gitleaks/gitleaks",
    ]:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate

    return None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _oid(doc: dict) -> dict:
    """Convert MongoDB _id to string id."""
    doc["id"] = str(doc.pop("_id"))
    return doc


def _fmt_dt(dt) -> str:
    """
    Serialize a datetime to ISO-8601 with explicit UTC marker ('Z').

    MongoDB datetimes are always stored in UTC but may be returned as naive
    (no tzinfo). Python's .isoformat() on a naive datetime omits the timezone
    offset, causing JavaScript's Date() to interpret the string as *local*
    time — producing a wrong offset (e.g. +05:30 for IST users).

    This helper always appends 'Z' so JS parses the timestamp as UTC and
    toLocaleString() / timeAgo() display it correctly in the user's timezone.
    """
    if dt is None:
        return None
    if hasattr(dt, "tzinfo") and dt.tzinfo is None:
        # Naive datetime from MongoDB — it's always UTC
        dt = dt.replace(tzinfo=timezone.utc)
    # Emit compact UTC string: "2026-02-27T09:05:00.123456Z"
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"


def _serialize_scan(doc: dict) -> dict:
    """Serialize all datetime fields in a scan document using _fmt_dt."""
    for field in ("created_at", "started_at", "completed_at", "gitleaks_completed_at"):
        if doc.get(field) is not None:
            doc[field] = _fmt_dt(doc[field])
    return doc


def _severity_order(s: str) -> int:
    return {"CRITICAL": 0, "ERROR": 1, "WARNING": 2, "INFO": 3}.get(s.upper(), 4)


def _gitleaks_severity(rule_id: str, tags: list) -> str:
    """Derive severity from gitleaks rule ID and tags."""
    rule_lower = rule_id.lower()
    critical_keywords = ["aws", "gcp", "azure", "stripe", "twilio", "rsa", "private-key", "ssh"]
    if any(k in rule_lower for k in critical_keywords):
        return "CRITICAL"
    return "HIGH"


# ─── Clone helper (runs in thread pool) ──────────────────────────────────────

def _clone_repo(auth_url: str, dest: str) -> None:
    """Shallow blobless git clone. Raises RuntimeError on failure."""
    result = subprocess.run(
        [
            "git", "clone",
            "--depth", "1",
            "--single-branch",
            "--no-tags",
            "--filter=blob:none",
            auth_url,
            dest,
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git clone failed: {result.stderr[:500]}")


# ─── Semgrep runner (runs in thread pool) ─────────────────────────────────────

def _run_semgrep(tmpdir: str) -> dict:
    """
    Run Semgrep against tmpdir.
    Returns parsed JSON output dict.
    """
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"

    result = subprocess.run(
        [
            _semgrep_bin(),
            "--config", "p/default",
            "--json",
            "--no-git-ignore",
            "--timeout", "60",
            tmpdir,
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=300,
    )

    # Exit 1 = findings exist, which is fine
    if result.returncode not in (0, 1):
        raise RuntimeError(
            f"Semgrep failed (exit {result.returncode}): {result.stderr[:500]}"
        )

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Could not parse Semgrep JSON output: {e}")


# ─── Gitleaks runner (runs in thread pool) ────────────────────────────────────

def _run_gitleaks(tmpdir: str) -> list:
    """
    Run gitleaks against tmpdir.
    Returns list of raw finding dicts. Returns [] if gitleaks is not installed.
    """
    gitleaks = _gitleaks_bin()
    if not gitleaks:
        logger.warning("gitleaks binary not found — skipping secrets scan")
        return []

    report_path = os.path.join(tmpdir, "gitleaks_report.json")

    # exit 1 = leaks found, exit 0 = clean — both are valid
    subprocess.run(
        [
            gitleaks, "detect",
            "--source", tmpdir,
            "--report-format", "json",
            "--report-path", report_path,
            "--no-git",       # scan staged files, not git history, since we shallow-cloned
            "--exit-code", "0",  # never fail the process even if secrets found
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )

    if not os.path.exists(report_path):
        return []

    try:
        with open(report_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
            return raw if isinstance(raw, list) else []
    except (json.JSONDecodeError, OSError):
        return []


# ─── Main parallel scan task ──────────────────────────────────────────────────

async def run_parallel_scan(
    scan_id: str,
    repo_full_name: str,
    clone_url: str,
    github_token: str,
    github_login: str,
) -> None:
    """
    Production-ready scan task:
    1. Clones repo once into a single temp directory
    2. Runs Semgrep + Gitleaks concurrently via asyncio.gather
    3. Persists both sets of findings
    4. Cleans up temp dir in finally block (guaranteed)
    """
    tmpdir: Optional[str] = None
    loop = asyncio.get_event_loop()

    try:
        # ── Mark scan as running ──────────────────────────────────────────────
        await scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$set": {
                    "status": "running",
                    "started_at": datetime.now(timezone.utc),
                    "gitleaks_status": "running",
                }
            },
        )

        # ── Clone repository ──────────────────────────────────────────────────
        tmpdir = tempfile.mkdtemp(prefix="be4breach_scan_")
        auth_url = clone_url.replace("https://", f"https://{github_token}@")

        logger.info("Cloning %s …", repo_full_name)
        await loop.run_in_executor(None, _clone_repo, auth_url, tmpdir)
        logger.info("Clone complete for %s", repo_full_name)

        # ── Run Semgrep + Gitleaks in parallel ────────────────────────────────
        semgrep_task = loop.run_in_executor(None, _run_semgrep, tmpdir)
        gitleaks_task = loop.run_in_executor(None, _run_gitleaks, tmpdir)

        semgrep_output, gitleaks_raw = await asyncio.gather(
            semgrep_task, gitleaks_task, return_exceptions=True
        )

        # ── Process Semgrep results ───────────────────────────────────────────
        sast_finding_docs = []
        semgrep_errors = []
        sast_summary = {"CRITICAL": 0, "ERROR": 0, "WARNING": 0, "INFO": 0}

        if isinstance(semgrep_output, Exception):
            logger.error("Semgrep error for %s: %s", repo_full_name, semgrep_output)
            semgrep_errors = [str(semgrep_output)]
        else:
            raw_findings = semgrep_output.get("results", [])
            semgrep_errors = [
                json.dumps(e, indent=2) if isinstance(e, dict) else str(e)
                for e in semgrep_output.get("errors", [])[:10]
            ]
            for f in raw_findings:
                meta = f.get("extra", {})
                sev = meta.get("severity", "INFO").upper()
                sast_finding_docs.append({
                    "scan_id": scan_id,
                    "repo_full_name": repo_full_name,
                    "github_login": github_login,
                    "type": "sast",
                    "rule_id": f.get("check_id", "unknown"),
                    "severity": sev,
                    "message": meta.get("message", ""),
                    "file_path": f.get("path", "").replace(tmpdir, "").replace(
                        tmpdir.replace("\\", "/"), ""
                    ).lstrip("/\\"),
                    "line_start": f.get("start", {}).get("line"),
                    "line_end": f.get("end", {}).get("line"),
                    "code_snippet": (
                        ""
                        if meta.get("lines", "").strip().lower()
                        in ("requires login", "requireslogin")
                        else meta.get("lines", "")
                    ),
                    "cwe": meta.get("metadata", {}).get("cwe", []),
                    "owasp": meta.get("metadata", {}).get("owasp", []),
                    "fix": meta.get("fix"),
                    "created_at": datetime.now(timezone.utc),
                })
                sast_summary[sev] = sast_summary.get(sev, 0) + 1

        if sast_finding_docs:
            await findings_collection.insert_many(sast_finding_docs)

        # ── Process Gitleaks results ──────────────────────────────────────────
        gitleaks_finding_docs = []
        gitleaks_summary = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        gitleaks_status = "completed"

        if isinstance(gitleaks_raw, Exception):
            logger.error("Gitleaks error for %s: %s", repo_full_name, gitleaks_raw)
            gitleaks_status = "failed"
        elif isinstance(gitleaks_raw, list):
            for f in gitleaks_raw:
                rule_id = f.get("RuleID", "unknown")
                tags = f.get("Tags", [])
                sev = _gitleaks_severity(rule_id, tags)

                # Mask secrets in the match field — show only first 4 chars
                raw_match = f.get("Match", "")
                safe_match = (raw_match[:4] + "****") if len(raw_match) > 4 else "****"

                gitleaks_finding_docs.append({
                    "scan_id": scan_id,
                    "repo_full_name": repo_full_name,
                    "github_login": github_login,
                    "type": "gitleaks",
                    "rule_id": rule_id,
                    "severity": sev,
                    "message": f.get("Description", "Secret detected"),
                    "file_path": f.get("File", "").replace(tmpdir, "").replace(
                        tmpdir.replace("\\", "/"), ""
                    ).lstrip("/\\"),
                    "line_start": f.get("StartLine", 0),
                    "line_end": f.get("EndLine", 0),
                    "code_snippet": safe_match,  # Never expose full secret
                    "secret_entropy": f.get("Entropy", 0),
                    "author": f.get("Author", ""),
                    "commit": f.get("Commit", "")[:8] if f.get("Commit") else "",
                    "cwe": ["CWE-798"],
                    "owasp": ["A07:2021 - Identification and Authentication Failures"],
                    "fix": "Revoke and rotate this secret immediately. Remove from source, add to .gitignore, and use environment variables or a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault).",
                    "created_at": datetime.now(timezone.utc),
                })
                gitleaks_summary[sev] = gitleaks_summary.get(sev, 0) + 1

        if gitleaks_finding_docs:
            await findings_collection.insert_many(gitleaks_finding_docs)

        # ── Persist final scan state ──────────────────────────────────────────
        await scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc),
                    "finding_count": len(sast_finding_docs),
                    "severity_summary": sast_summary,
                    "semgrep_errors": semgrep_errors,
                    # Gitleaks metadata
                    "gitleaks_status": gitleaks_status,
                    "gitleaks_completed_at": datetime.now(timezone.utc),
                    "gitleaks_finding_count": len(gitleaks_finding_docs),
                    "gitleaks_severity": gitleaks_summary,
                }
            },
        )

        logger.info(
            "Scan %s done: %d SAST findings, %d secrets for %s",
            scan_id, len(sast_finding_docs), len(gitleaks_finding_docs), repo_full_name,
        )

    except Exception as exc:
        logger.exception("Scan %s failed: %s", scan_id, exc)
        await scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$set": {
                    "status": "failed",
                    "completed_at": datetime.now(timezone.utc),
                    "error": str(exc),
                }
            },
        )
    finally:
        # Always clean up — runs whether success or failure
        if tmpdir and os.path.exists(tmpdir):
            shutil.rmtree(tmpdir, ignore_errors=True)
            logger.debug("Cleaned up temp dir: %s", tmpdir)


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/scan/{owner}/{repo}")
async def trigger_scan(
    owner: str,
    repo: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Trigger a parallel Semgrep + Gitleaks scan on a GitHub repository.
    Returns immediately with scan_id; poll for results.
    """
    github_token = current_user.get("github_token")
    github_login = current_user.get("github_login") or current_user.get("email")

    if not github_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub token. Please sign in with GitHub.",
        )

    repo_full_name = f"{owner}/{repo}"

    # Verify repo exists
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"https://api.github.com/repos/{repo_full_name}",
            headers={
                "Authorization": f"Bearer {github_token}",
                "Accept": "application/vnd.github+json",
            },
        )

    if r.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Repository '{repo_full_name}' not found.")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to verify repository access.")

    repo_data = r.json()
    clone_url = repo_data["clone_url"]

    # Check if a scan is already in progress
    existing = await scans_collection.find_one(
        {"repo_full_name": repo_full_name, "github_login": github_login, "status": "running"}
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A scan is already running for this repository. Please wait.",
        )

    # Create scan document
    scan_doc = {
        "repo_full_name": repo_full_name,
        "repo_id": repo_data["id"],
        "github_login": github_login,
        "status": "queued",
        "finding_count": 0,
        "severity_summary": {"CRITICAL": 0, "ERROR": 0, "WARNING": 0, "INFO": 0},
        # Gitleaks fields
        "gitleaks_status": "queued",
        "gitleaks_finding_count": 0,
        "gitleaks_severity": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "created_at": datetime.now(timezone.utc),
        "started_at": None,
        "completed_at": None,
        "error": None,
        "semgrep_errors": [],
    }

    result = await scans_collection.insert_one(scan_doc)
    scan_id = str(result.inserted_id)

    # Single background task — runs both scanners in parallel internally
    background_tasks.add_task(
        run_parallel_scan,
        scan_id=scan_id,
        repo_full_name=repo_full_name,
        clone_url=clone_url,
        github_token=github_token,
        github_login=github_login,
    )

    return {
        "scan_id": scan_id,
        "repo_full_name": repo_full_name,
        "status": "queued",
        "message": "Scan queued. Semgrep + Gitleaks will run in parallel.",
    }


@router.get("/scan/{scan_id}/results")
async def get_scan_results(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Poll scan status and retrieve SAST findings once complete."""
    github_login = current_user.get("github_login") or current_user.get("email")

    try:
        oid = ObjectId(scan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scan_id format.")

    scan = await scans_collection.find_one({"_id": oid, "github_login": github_login})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    scan = _serialize_scan(_oid(scan))

    # Return only SAST findings here (type=sast or no type field for backwards compat)
    findings = []
    if scan["status"] == "completed":
        cursor = findings_collection.find(
            {"scan_id": scan_id, "type": {"$in": ["sast", None]}},
            {"_id": 0},
        )
        findings = await cursor.to_list(length=None)
        findings.sort(key=lambda f: _severity_order(f.get("severity", "INFO")))

    return {"scan": scan, "findings": findings}


@router.get("/scan/{scan_id}/gitleaks")
async def get_gitleaks_results(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieve Gitleaks (secrets scan) findings for a given scan_id."""
    github_login = current_user.get("github_login") or current_user.get("email")

    try:
        oid = ObjectId(scan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scan_id format.")

    scan = await scans_collection.find_one({"_id": oid, "github_login": github_login})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    scan = _serialize_scan(_oid(scan))

    findings = []
    if scan.get("gitleaks_status") == "completed":
        cursor = findings_collection.find(
            {"scan_id": scan_id, "type": "gitleaks"},
            {"_id": 0},
        )
        findings = await cursor.to_list(length=None)
        # Sort by severity (CRITICAL first)
        sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        findings.sort(key=lambda f: sev_order.get(f.get("severity", "LOW"), 4))

    return {
        "scan": scan,
        "gitleaks_status": scan.get("gitleaks_status", "unknown"),
        "gitleaks_finding_count": scan.get("gitleaks_finding_count", 0),
        "gitleaks_severity": scan.get("gitleaks_severity", {}),
        "findings": findings,
    }


@router.get("/scan/{owner}/{repo}/latest")
async def get_latest_scan(
    owner: str,
    repo: str,
    current_user: dict = Depends(get_current_user),
):
    """Return the latest scan (any status) for a given repository."""
    github_login = current_user.get("github_login") or current_user.get("email")
    repo_full_name = f"{owner}/{repo}"

    scan = await scans_collection.find_one(
        {"repo_full_name": repo_full_name, "github_login": github_login},
        sort=[("created_at", -1)],
    )

    if not scan:
        return {"scan": None, "findings": []}

    scan = _serialize_scan(_oid(scan))

    findings = []
    if scan["status"] == "completed":
        cursor = findings_collection.find(
            {"scan_id": scan["id"], "type": {"$in": ["sast", None]}},
            {"_id": 0},
        )
        findings = await cursor.to_list(length=None)
        findings.sort(key=lambda f: _severity_order(f.get("severity", "INFO")))

    return {"scan": scan, "findings": findings}


@router.get("/scans/history")
async def get_scan_history(
    current_user: dict = Depends(get_current_user),
):
    """Return all scans for the current user, newest first."""
    github_login = current_user.get("github_login") or current_user.get("email")

    cursor = scans_collection.find(
        {"github_login": github_login},
        sort=[("created_at", -1)],
        limit=50,
    )
    scans = await cursor.to_list(length=50)

    result = [_serialize_scan(_oid(s)) for s in scans]

    return result


@router.get("/scans/{owner}/{repo}/history")
async def get_repo_scan_history(
    owner: str,
    repo: str,
    current_user: dict = Depends(get_current_user),
):
    """Return all scans for a specific repository, newest first."""
    github_login = current_user.get("github_login") or current_user.get("email")
    repo_full_name = f"{owner}/{repo}"

    cursor = scans_collection.find(
        {"repo_full_name": repo_full_name, "github_login": github_login},
        sort=[("created_at", -1)],
        limit=100,
    )
    scans = await cursor.to_list(length=100)

    return [_serialize_scan(_oid(s)) for s in scans]
