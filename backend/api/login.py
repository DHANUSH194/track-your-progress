import logging

from fastapi import APIRouter, HTTPException, Request, Response
from ..models.model import LoginRequest
from ..services.config import admin_supabase, create_auth_client
from ..services.session import set_session_cookies

router=APIRouter()
logger = logging.getLogger(__name__)

@router.post("/login")
def login(payload:LoginRequest, request: Request, response: Response):
    try:
        user_result = (
            admin_supabase.table("users")
            .select("email")
            .eq("user_name", payload.username.strip())
            .limit(2)
            .execute()
        )
        matching_users = user_result.data or []
        if len(matching_users) != 1 or not matching_users[0].get("email"):
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password.",
            )

        email = matching_users[0]["email"]
        auth_response=create_auth_client().auth.sign_in_with_password({
            "email":email,
            "password":payload.password
        })
        
        if not auth_response.session:
            raise HTTPException(
                status_code=401,
                detail="Login failed. Check your email and password, and confirm your email if required.",
            )
        
        session = auth_response.session
        set_session_cookies(response, session, request)
        
        return {
            "message":"Login Successsful",
            "email":email,
        }
    
    except HTTPException:
        raise
    except Exception as error:
        status_code = getattr(error, "status", getattr(error, "status_code", None))
        if status_code in (400, 401):
            message = getattr(error, "message", str(error)).casefold()
            if "email not confirmed" in message:
                raise HTTPException(
                    status_code=401,
                    detail="This account’s email address is not confirmed. Confirm it in Supabase before signing in.",
                ) from error
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password.",
            ) from error
        logger.exception("Supabase login request failed")
        raise HTTPException(
            status_code=503,
            detail="The login service is unavailable. Check the backend Supabase configuration.",
        ) from error
    
    
    