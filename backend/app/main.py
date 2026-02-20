from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router
from app.routes.cyber import router as cyber_router
from app.routes.github import router as github_router
from app.routes.scan import router as scan_router
from app.routes.compliance import router as compliance_router
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Be4Breach API")

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

@app.get("/")
async def root():
    return {"message": "Welcome to Be4Breach API"}
