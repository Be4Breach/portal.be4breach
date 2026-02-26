from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router
from app.routes.cyber import router as cyber_router
from app.routes.github import router as github_router
from app.routes.scan import router as scan_router
from app.routes.compliance import router as compliance_router
from app.routes.reports import router as reports_router
from app.routes.ai import router as ai_router
from app.routes.identity import router as identity_router
from app.routes.gcp import router as gcp_router
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Be4Breach API")

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "Validation Error", "details": exc.errors()},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"GLOBAL ERROR: {str(exc)}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "message": str(exc)},
    )


@app.on_event("startup")
async def startup_event():
    try:
        from app.database import init_db
        await init_db()
    except Exception as e:
        # Don't let DB failure crash the entire API on startup
        print(f"CRITICAL WARNING: API started without database connectivity. Endpoints may fail. Error: {str(e)}")

# Configure CORS
origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [origin.strip() for origin in origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(cyber_router, tags=["Cyber Dashboard"])
app.include_router(github_router, prefix="/api/github", tags=["GitHub"])
app.include_router(scan_router, prefix="/api", tags=["Security Scanning"])
app.include_router(compliance_router, prefix="/api/compliance", tags=["Compliance"])
app.include_router(reports_router, prefix="/api/reports", tags=["Reports"])
app.include_router(ai_router, prefix="/api/ai", tags=["AI Copilot"])
app.include_router(identity_router, prefix="/api/identity-risk-intelligence", tags=["Identity Analyzer"])
app.include_router(gcp_router, prefix="/api/integrations/gcp", tags=["GCP Integration"])

@app.get("/")
async def root():
    return {"message": "Welcome to Be4Breach API"}
