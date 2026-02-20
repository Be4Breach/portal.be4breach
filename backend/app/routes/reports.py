from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import Dict
from app.report_parser import parse_uploaded_file
from app.auth import get_current_user
from fastapi import Depends

router = APIRouter()

@router.post("/pentest-report")
async def api_pentest_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload and parse a pentest DOCX report into dashboard-ready JSON."""
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported.")

    try:
        file.file.seek(0)
        report = parse_uploaded_file(file)
        if not report.get("findings"):
            raise HTTPException(
                status_code=422,
                detail="Parsed report but found 0 findings; ensure the uploaded DOCX uses the standard summary and detail tables."
            )
        return {"success": True, "report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse report: {e}")
