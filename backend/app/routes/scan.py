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

# Resolve semgrep binary: prefer venv Scripts/, then PATH
def _semgrep_bin() -> str:
    venv_bin = Path(sys.executable).parent / "semgrep"
    if sys.platform == "win32":
        venv_bin = venv_bin.with_suffix(".exe")
    if venv_bin.exists():
        return str(venv_bin)
    found = shutil.which("semgrep")
    if found:
        return found
    raise FileNotFoundError(
        "semgrep not found. Install it with: pip install semgrep"
    )

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _oid(doc: dict) -> dict:
    """Convert MongoDB _id to string id."""
    doc["id"] = str(doc.pop("_id"))
    return doc


def _severity_order(s: str) -> int:
    return {"CRITICAL": 0, "ERROR": 1, "WARNING": 2, "INFO": 3}.get(s.upper(), 4)


# ─── Background scan task ─────────────────────────────────────────────────────

async def run_scan(
    scan_id: str,
    repo_full_name: str,
    clone_url: str,
    github_token: str,
    github_login: str,
):
    """
    Clones the repo, runs Semgrep, parses JSON output, stores results in MongoDB.
    Runs as a FastAPI BackgroundTask so the HTTP response returns immediately.
    """
    tmpdir: Optional[str] = None

    try:
        # ── Mark scan as running ──────────────────────────────────────────────
        await scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {"$set": {"status": "running", "started_at": datetime.now(timezone.utc)}},
        )

        # ── Clone repo into a temp directory ─────────────────────────────────
        tmpdir = tempfile.mkdtemp(prefix="be4breach_scan_")
        auth_url = clone_url.replace("https://", f"https://{github_token}@")

        # Use blobless clone (--filter=blob:none) — git fetches only tree/commit
        # objects during clone; file blobs are fetched lazily on access.
        # Combined with --depth 1 and --single-branch this is very fast even
        # on slow connections. Timeout raised to 300s for large repos.
        clone_result = subprocess.run(
            [
                "git", "clone",
                "--depth", "1",
                "--single-branch",      # only default branch, skip all other refs
                "--no-tags",            # skip fetching tag objects
                "--filter=blob:none",   # blobless: don't download file content during clone
                auth_url,
                tmpdir,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=300,              # raised from 120s → 300s
        )

        if clone_result.returncode != 0:
            raise RuntimeError(f"git clone failed: {clone_result.stderr[:500]}")


        # ── Run Semgrep ───────────────────────────────────────────────────────
        # Force UTF-8 on Windows — semgrep outputs Unicode that cp1252 can't encode
        semgrep_env = os.environ.copy()
        semgrep_env["PYTHONIOENCODING"] = "utf-8"
        semgrep_env["PYTHONUTF8"] = "1"

        semgrep_result = subprocess.run(
            [
                _semgrep_bin(),
                # p/default = curated free ruleset, no Semgrep account needed.
                # 'auto' is avoided because Pro rules return 'requires login'
                # as the code snippet when not authenticated.
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
            env=semgrep_env,
            timeout=300,
        )



        # Semgrep exits 1 when findings exist — that's fine
        if semgrep_result.returncode not in (0, 1):
            raise RuntimeError(
                f"Semgrep failed (exit {semgrep_result.returncode}): "
                f"{semgrep_result.stderr[:500]}"
            )

        # ── Parse findings ────────────────────────────────────────────────────
        try:
            output = json.loads(semgrep_result.stdout)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Could not parse Semgrep JSON output: {e}")

        raw_findings = output.get("results", [])
        errors = output.get("errors", [])

        # Build finding documents
        finding_docs = []
        for f in raw_findings:
            meta = f.get("extra", {})
            finding_docs.append({
                "scan_id": scan_id,
                "repo_full_name": repo_full_name,
                "github_login": github_login,
                "rule_id": f.get("check_id", "unknown"),
                "severity": meta.get("severity", "INFO").upper(),
                "message": meta.get("message", ""),
                "file_path": f.get("path", "").replace(tmpdir, "").replace(tmpdir.replace("\\", "/"), "").lstrip("/\\"),
                "line_start": f.get("start", {}).get("line"),
                "line_end": f.get("end", {}).get("line"),
                # Semgrep Pro returns "requires login" when unauthenticated — replace with empty
                "code_snippet": "" if meta.get("lines", "").strip().lower() in ("requires login", "requireslogin") else meta.get("lines", ""),
                "cwe": meta.get("metadata", {}).get("cwe", []),
                "owasp": meta.get("metadata", {}).get("owasp", []),
                "fix": meta.get("fix"),
                "created_at": datetime.now(timezone.utc),
            })

        # Insert findings
        if finding_docs:
            await findings_collection.insert_many(finding_docs)

        # Severity summary
        summary = {"CRITICAL": 0, "ERROR": 0, "WARNING": 0, "INFO": 0}
        for fd in finding_docs:
            sev = fd["severity"]
            summary[sev] = summary.get(sev, 0) + 1

        # ── Mark scan complete ────────────────────────────────────────────────
        await scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc),
                    "finding_count": len(finding_docs),
                    "severity_summary": summary,
                    # Serialize errors: dicts → formatted strings, strings → as-is
                    "semgrep_errors": [
                        json.dumps(e, indent=2) if isinstance(e, dict) else str(e)
                        for e in errors[:10]
                    ],
                }
            },
        )
        logger.info(
            "Scan %s completed: %d findings for %s", scan_id, len(finding_docs), repo_full_name
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
        # ── Clean up temp directory ───────────────────────────────────────────
        if tmpdir and os.path.exists(tmpdir):
            shutil.rmtree(tmpdir, ignore_errors=True)


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/scan/{owner}/{repo}")
async def trigger_scan(
    owner: str,
    repo: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Trigger an async security scan on a GitHub repository.
    Returns immediately with a scan_id; poll GET /scan/{scan_id}/results for status.
    """
    github_token = current_user.get("github_token")
    github_login = current_user.get("github_login") or current_user.get("email")

    if not github_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub token. Please sign in with GitHub.",
        )

    repo_full_name = f"{owner}/{repo}"

    # Verify repo exists and user has access
    async with httpx.AsyncClient() as client:
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

    # Check if a scan is already running for this repo
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
        "created_at": datetime.now(timezone.utc),
        "started_at": None,
        "completed_at": None,
        "error": None,
        "semgrep_errors": [],
    }

    result = await scans_collection.insert_one(scan_doc)
    scan_id = str(result.inserted_id)

    # Queue the background task
    background_tasks.add_task(
        run_scan,
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
        "message": "Scan queued. Poll GET /scan/{scan_id}/results for status.",
    }


@router.get("/scan/{scan_id}/results")
async def get_scan_results(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Poll scan status and retrieve findings once complete."""
    github_login = current_user.get("github_login") or current_user.get("email")

    try:
        oid = ObjectId(scan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scan_id format.")

    scan = await scans_collection.find_one({"_id": oid, "github_login": github_login})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    scan = _oid(scan)

    # Serialize datetime fields
    for field in ("created_at", "started_at", "completed_at"):
        if scan.get(field):
            scan[field] = scan[field].isoformat()

    findings = []
    if scan["status"] == "completed":
        cursor = findings_collection.find(
            {"scan_id": scan_id},
            {"_id": 0},
        ).sort("severity", 1)
        findings = await cursor.to_list(length=None)
        # Sort by severity order
        findings.sort(key=lambda f: _severity_order(f.get("severity", "INFO")))

    return {"scan": scan, "findings": findings}


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

    scan = _oid(scan)
    for field in ("created_at", "started_at", "completed_at"):
        if scan.get(field):
            scan[field] = scan[field].isoformat()

    findings = []
    if scan["status"] == "completed":
        cursor = findings_collection.find(
            {"scan_id": scan["id"]},
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

    result = []
    for s in scans:
        s = _oid(s)
        for field in ("created_at", "started_at", "completed_at"):
            if s.get(field):
                s[field] = s[field].isoformat()
        result.append(s)

    return result
