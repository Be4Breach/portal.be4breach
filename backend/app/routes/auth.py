from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.models import UserCreate, UserLogin, Token, UserResponse
from app.database import user_collection, user_helper
from app.auth import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@router.post("/signup", response_model=UserResponse)
async def signup(user: UserCreate):
    # Check if user exists
    existing_user = await user_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Hash password
    hashed_password = get_password_hash(user.password)
    
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    user_dict["role"] = "user"
    user_dict["is_approved"] = False
    
    new_user = await user_collection.insert_one(user_dict)
    created_user = await user_collection.find_one({"_id": new_user.inserted_id})
    
    return user_helper(created_user)

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await user_collection.find_one({"email": form_data.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.get("is_approved", False):
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not approved. Please contact administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user["email"],
            "role": user.get("role", "user"),
            "auth_provider": "email",
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            # Include GitHub fields if user has connected their account
            "github_login": user.get("github_login"),
            "github_name": user.get("github_name"),
            "github_avatar": user.get("github_avatar"),
            "github_token": user.get("github_token"),
        },
        expires_delta=access_token_expires,
    )

    return {"access_token": access_token, "token_type": "bearer"}

