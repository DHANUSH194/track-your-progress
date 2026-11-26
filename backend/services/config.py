import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "86400"))
SESSION_COOKIE_SECURE_SETTING = os.getenv("SESSION_COOKIE_SECURE")
SESSION_COOKIE_SECURE = (
    SESSION_COOKIE_SECURE_SETTING.lower() == "true"
    if SESSION_COOKIE_SECURE_SETTING is not None
    else None
)
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "lax").lower()
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

if SESSION_TTL_SECONDS <= 0:
    raise RuntimeError("SESSION_TTL_SECONDS must be greater than zero.")
if SESSION_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("SESSION_COOKIE_SAMESITE must be lax, strict, or none.")
if SESSION_COOKIE_SAMESITE == "none" and SESSION_COOKIE_SECURE is False:
    raise RuntimeError("SameSite=None cookies require SESSION_COOKIE_SECURE=true.")

missing_settings = [
    name
    for name, value in (
        ("SUPABASE_URL", SUPABASE_URL),
        ("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY),
        ("SUPABASE_SECRET_KEY", SUPABASE_SECRET_KEY),
    )
    if not value
]
if missing_settings:
    raise RuntimeError(
        f"Missing required Supabase environment variables: {', '.join(missing_settings)}"
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
admin_supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)


def create_auth_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)