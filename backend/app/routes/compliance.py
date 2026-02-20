from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Optional
from app.database import database
from app.auth import get_current_user

router = APIRouter()
compliance_collection = database.get_collection("compliance_answers")

class AnswerRecord(BaseModel):
    answer: Optional[str] = None
    evidenceName: Optional[str] = None

class ComplianceData(BaseModel):
    answers: Dict[str, AnswerRecord] = {}
    complete: bool = False

@router.get("/", response_model=ComplianceData)
async def get_compliance(current_user: dict = Depends(get_current_user)):
    user_email = current_user.get("email")
    if not user_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        
    doc = await compliance_collection.find_one({"email": user_email})
    if not doc:
        return ComplianceData(answers={}, complete=False)
        
    return ComplianceData(
        answers=doc.get("answers", {}),
        complete=doc.get("complete", False)
    )

@router.post("/")
async def save_compliance(data: ComplianceData, current_user: dict = Depends(get_current_user)):
    user_email = current_user.get("email")
    if not user_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        
    update_data = {
        "email": user_email,
        "answers": data.model_dump().get("answers", {}) if hasattr(data, 'model_dump') else data.dict().get("answers", {}), 
        "complete": data.complete
    }
    
    await compliance_collection.update_one(
        {"email": user_email},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Compliance data saved"}
