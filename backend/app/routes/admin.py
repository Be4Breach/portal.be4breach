from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from bson import ObjectId
from app.models import UserResponse
from app.database import user_collection, user_helper
from app.auth import get_current_admin

router = APIRouter()

@router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_admin)):
    users = []
    async for user in user_collection.find():
        users.append(user_helper(user))
    return users

@router.put("/users/{user_id}/approve", response_model=UserResponse)
async def approve_user(user_id: str, current_user: dict = Depends(get_current_admin)):
    try:
        oid = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    user = await user_collection.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await user_collection.update_one({"_id": oid}, {"$set": {"is_approved": True}})
    updated_user = await user_collection.find_one({"_id": oid})
    return user_helper(updated_user)

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, current_user: dict = Depends(get_current_admin)):
    try:
        oid = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    result = await user_collection.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
