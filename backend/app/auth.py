from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Union
from jose import JWTError, jwt
import os
from .database import user_collection

from dotenv import load_dotenv

load_dotenv()

# Secret key for JWT encoding/decoding
SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_change_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Union[timedelta, None] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # GitHub OAuth-only users — return JWT payload directly
    if payload.get("auth_provider") == "github":
        return {
            "email": sub,
            "github_login": payload.get("github_login"),
            "github_name": payload.get("github_name"),
            "github_avatar": payload.get("github_avatar"),
            "github_token": payload.get("github_token"),
            "auth_provider": "github",
            "role": payload.get("role", "user"),
        }

    # Email/password users — look up in MongoDB, then merge in JWT github fields
    # (JWT github fields come from the connect flow and are fresher than DB for the token)
    user = await user_collection.find_one({"email": sub})
    if user is None:
        raise credentials_exception

    # Overlay github fields from the JWT (they may be newer than DB if recently connected)
    if payload.get("github_token"):
        user["github_token"] = payload.get("github_token")
        user["github_login"] = payload.get("github_login") or user.get("github_login")
        user["github_name"] = payload.get("github_name") or user.get("github_name")
        user["github_avatar"] = payload.get("github_avatar") or user.get("github_avatar")

    return user


async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized"
        )
    return current_user
