import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(None, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class OAuthProviderInfo(BaseModel):
    provider: str
    connected_at: datetime

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    email_verified: bool
    display_name: str | None = None
    avatar_url: str | None = None
    auth_provider: str
    connected_providers: list[OAuthProviderInfo] = []
    hardware: "HardwareResponse | None" = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=100)
    avatar_url: str | None = None


class HardwareUpdate(BaseModel):
    gpu_model: str | None = Field(None, max_length=150)
    cpu_model: str | None = Field(None, max_length=150)
    ram_gb: int | None = None
    vram_mb: int | None = None
    cpu_cores: int | None = None
    cpu_speed_ghz: float | None = None
    hardware_raw_text: str | None = None
    storage_drives: str | None = None


class HardwareResponse(BaseModel):
    gpu_model: str | None = None
    cpu_model: str | None = None
    ram_gb: int | None = None
    vram_mb: int | None = None
    cpu_cores: int | None = None
    cpu_speed_ghz: float | None = None
    hardware_tier: str | None = None
    hardware_raw_text: str | None = None
    storage_drives: str | None = None

    model_config = {"from_attributes": True}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
