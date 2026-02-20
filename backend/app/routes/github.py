import os
import httpx
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import RedirectResponse
from app.auth import create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import user_collection
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/api/github/callback")
GITHUB_CONNECT_URI = os.getenv("GITHUB_CONNECT_URI", "http://localhost:8000/api/github/connect/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# ── Helper: fetch GitHub user profile + primary email ─────────────────────────

async def _fetch_github_user(access_token: str) -> tuple[dict, str]:
    """Returns (github_user_dict, email)."""
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"},
        )
    if user_resp.status_code != 200:
        raise RuntimeError("Failed to fetch GitHub user profile")
    github_user = user_resp.json()

    email = github_user.get("email")
    if not email:
        async with httpx.AsyncClient() as client:
            email_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"},
            )
        if email_resp.status_code == 200:
            emails = email_resp.json()
            primary = next((e for e in emails if e.get("primary") and e.get("verified")), None)
            email = primary["email"] if primary else (emails[0]["email"] if emails else "")

    return github_user, email


# ── 1. GitHub OAuth Login (standalone — no existing account needed) ───────────

@router.get("/login")
async def github_login():
    """Redirect user to GitHub OAuth authorization page."""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth is not configured. Set GITHUB_CLIENT_ID in environment.",
        )
    scope = "read:user user:email repo"
    github_auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={GITHUB_REDIRECT_URI}"
        f"&scope={scope}"
    )
    return RedirectResponse(url=github_auth_url)


@router.get("/callback")
async def github_callback(code: str, state: str = ""):
    """
    Unified GitHub OAuth callback.
    - state == ''               → plain GitHub login (new or existing GitHub-auth user)
    - state == 'connect:<email>' → link GitHub to an existing email/password account
    """
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured.")

    # Exchange code for GitHub access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )

    token_data = token_response.json()
    if "error" in token_data:
        error_msg = token_data.get("error_description", token_data["error"])
        redirect_page = "settings" if state.startswith("connect:") else "login"
        return RedirectResponse(url=f"{FRONTEND_URL}/{redirect_page}?error={error_msg}")

    github_access_token = token_data.get("access_token")
    if not github_access_token:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=Failed+to+obtain+access+token")

    try:
        github_user, gh_email = await _fetch_github_user(github_access_token)
    except RuntimeError as e:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error={str(e)}")

    # ── Connect flow: link GitHub to existing email/password account ──────────
    if state.startswith("connect:"):
        user_email = state[len("connect:"):]
        if not user_email:
            return RedirectResponse(url=f"{FRONTEND_URL}/settings?github_error=Missing+user+email+in+state")

        # Save GitHub info to MongoDB
        await user_collection.update_one(
            {"email": user_email},
            {"$set": {
                "github_login": github_user.get("login"),
                "github_name": github_user.get("name") or github_user.get("login"),
                "github_avatar": github_user.get("avatar_url"),
                "github_token": github_access_token,
            }},
        )

        db_user = await user_collection.find_one({"email": user_email})
        jwt_token = create_access_token(
            data={
                "sub": user_email,
                "auth_provider": "email",
                "role": db_user.get("role", "user") if db_user else "user",
                "first_name": db_user.get("first_name", "") if db_user else "",
                "last_name": db_user.get("last_name", "") if db_user else "",
                "github_login": github_user.get("login"),
                "github_name": github_user.get("name") or github_user.get("login"),
                "github_avatar": github_user.get("avatar_url"),
                "github_token": github_access_token,
            },
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        # Redirect to /auth/callback with next=/settings?github_connected=1
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth/callback?token={jwt_token}&next=/settings%3Fgithub_connected=1"
        )

    # ── Login flow: standard GitHub-only auth ─────────────────────────────────
    jwt_token = create_access_token(
        data={
            "sub": gh_email or github_user.get("login"),
            "github_login": github_user.get("login"),
            "github_name": github_user.get("name") or github_user.get("login"),
            "github_avatar": github_user.get("avatar_url"),
            "github_token": github_access_token,
            "auth_provider": "github",
            "role": "user",
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?token={jwt_token}")


# ── 2. GitHub Connect (link to existing email/password account) ───────────────

@router.get("/connect")
async def github_connect(auth_token: str = ""):
    """
    Start the GitHub OAuth flow for an already-authenticated email/password user.
    Accepts auth_token as a query param (browser navigates directly; can't set headers).
    Encodes the user's email as OAuth 'state' so the callback can find the right user.
    """
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured.")
    if not auth_token:
        raise HTTPException(status_code=401, detail="auth_token query parameter is required.")

    # Validate the JWT manually (same logic as get_current_user, without header requirement)
    from jose import JWTError, jwt as jose_jwt
    import os
    SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_change_in_production")
    try:
        payload = jose_jwt.decode(auth_token, SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub", "")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not email:
        raise HTTPException(status_code=401, detail="Could not determine user from token.")

    scope = "read:user user:email repo"
    # Reuse the registered redirect URI — encode 'connect:<email>' in state
    # so /callback can distinguish a connect flow from a plain login.
    github_auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={GITHUB_REDIRECT_URI}"
        f"&scope={scope}"
        f"&state=connect:{email}"
    )
    return RedirectResponse(url=github_auth_url)



# /connect/callback is no longer needed — the connect flow now reuses /callback
# with state='connect:<email>' so no extra redirect URI registration is required.


# ── 3. List GitHub repos ──────────────────────────────────────────────────────

@router.get("/repos")
async def get_github_repos(current_user: dict = Depends(get_current_user)):
    """Fetch the authenticated user's GitHub repositories."""
    github_token = current_user.get("github_token")
    if not github_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub token associated with this account. Please connect your GitHub account.",
        )

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user/repos",
            params={"sort": "updated", "per_page": 100, "affiliation": "owner,collaborator,organization_member"},
            headers={"Authorization": f"Bearer {github_token}", "Accept": "application/vnd.github+json"},
        )

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub token is invalid or expired. Please reconnect your GitHub account.")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {response.status_code}")

    repos = response.json()
    return [
        {
            "id": repo["id"],
            "name": repo["name"],
            "full_name": repo["full_name"],
            "description": repo.get("description"),
            "private": repo["private"],
            "html_url": repo["html_url"],
            "language": repo.get("language"),
            "stargazers_count": repo["stargazers_count"],
            "forks_count": repo["forks_count"],
            "open_issues_count": repo["open_issues_count"],
            "default_branch": repo["default_branch"],
            "updated_at": repo["updated_at"],
            "created_at": repo["created_at"],
            "topics": repo.get("topics", []),
            "visibility": repo.get("visibility", "private" if repo["private"] else "public"),
            "size": repo["size"],
        }
        for repo in repos
    ]
