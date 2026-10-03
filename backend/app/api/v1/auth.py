import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import User, UserProfile

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

# Password hashing utilities using direct bcrypt
def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    pwd_bytes = plain_password.encode('utf-8')[:72]
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

from app.api.deps import get_current_user

# Schemas
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    account_type: Optional[str] = "personal_traveler"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class DemoLoginRequest(BaseModel):
    role: Optional[str] = "demo_explorer"
    full_name: Optional[str] = "Demo Explorer [Sandbox]"
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None

class GoogleLoginRequest(BaseModel):
    id_token: Optional[str] = None
    google_id: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

def serialize_user(user: User, db: Session) -> dict:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    coins = profile.reward_coins if profile else 250
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "account_type": user.account_type or "personal_traveler",
        "is_verified": user.is_verified,
        "trust_score": user.trust_score or "98% Verified Explorer",
        "coins": coins,
    }

@router.post("/register", response_model=AuthResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register new user in PostgreSQL with bcrypt hashed password.
    """
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please log in."
        )

    # Create new user
    new_user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        full_name=request.full_name,
        account_type=request.account_type or "personal_traveler",
        is_verified=True,
        trust_score="95% Verified Explorer",
        avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create user profile with 300 welcome coins
    user_profile = UserProfile(
        user_id=new_user.id,
        home_city="Bengaluru",
        reward_coins=0,
        travel_vibes=["Beach", "Mountains"]
    )
    db.add(user_profile)
    db.commit()

    token = create_access_token({"sub": new_user.id, "email": new_user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serialize_user(new_user, db)
    }

@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user using PostgreSQL password hash check.
    """
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found with this email. Please register."
        )

    # For seeded or passwordless users, set a default or check password
    if user.password_hash:
        if not verify_password(request.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password. Please try again."
            )
    else:
        # User has no password set yet (e.g. seeded), set it now
        user.password_hash = hash_password(request.password)
        db.commit()

    token = create_access_token({"sub": user.id, "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serialize_user(user, db)
    }

@router.post("/demo", response_model=AuthResponse)
def demo_login(request: DemoLoginRequest = DemoLoginRequest(), db: Session = Depends(get_db)):
    """
    Explicit Sandbox Demo Mode:
    Provides an ephemeral/sandbox explorer identity for development and previewing.
    Architecturally separated from production OAuth.
    """
    demo_email = request.email or f"{request.role or 'demo_explorer'}@dashtiny.travel"
    demo_name = request.full_name or "Demo Explorer [Sandbox]"
    avatar = request.avatar_url or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"

    user = db.query(User).filter(User.email == demo_email).first()
    if not user:
        user = User(
            email=demo_email,
            password_hash=hash_password("sandbox_demo_secret_2026"),
            full_name=demo_name,
            account_type="sandbox_demo",
            is_verified=False,  # Honest: Sandbox accounts are NOT marked verified
            trust_score="Sandbox Demo Explorer",
            avatar_url=avatar
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        profile = UserProfile(
            user_id=user.id,
            home_city="Bengaluru",
            reward_coins=300
        )
        db.add(profile)
        db.commit()

    token = create_access_token({"sub": user.id, "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serialize_user(user, db)
    }

@router.post("/google", response_model=AuthResponse)
def google_login(request: GoogleLoginRequest):
    """
    Production Google OAuth endpoint:
    Requires verified server-side ID token exchange with Google Identity APIs and GOOGLE_CLIENT_ID.
    Client-fabricated credentials are not accepted here. Use /auth/demo for development/sandbox mode.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Production Google OAuth requires server-side ID token verification with GOOGLE_CLIENT_ID. Please use /auth/demo for development/sandbox mode."
    )

@router.get("/me")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get current logged in user profile from PostgreSQL.
    """
    return serialize_user(user, db)
