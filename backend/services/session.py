import hashlib
import hmac
import logging
import time

from fastapi import HTTPException, Request, Response
from supabase_auth.types import Session, User

from .config import (
    SESSION_COOKIE_SAMESITE,
    SESSION_COOKIE_SECURE,
    SESSION_TTL_SECONDS,
    SUPABASE_SECRET_KEY,
    create_auth_client,
    supabase,
)

ACCESS_COOKIE = "repwise_access"
REFRESH_COOKIE = "repwise_refresh"
DEADLINE_COOKIE = "repwise_session_deadline"
AUTH_ERROR_STATUSES = (400, 401, 403)
logger = logging.getLogger(__name__)


def _sign_deadline(deadline: int) -> str:
    signature = hmac.new(
        SUPABASE_SECRET_KEY.encode(),
        str(deadline).encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{deadline}.{signature}"


def _read_deadline(value: str | None) -> int | None:
    if not value:
        return None
    try:
        deadline_text, signature = value.split(".", 1)
        deadline = int(deadline_text)
    except (ValueError, TypeError):
        return None

    expected = _sign_deadline(deadline).split(".", 1)[1]
    if not hmac.compare_digest(signature, expected):
        return None
    return deadline


def set_session_cookies(
    response: Response,
    session: Session,
    request: Request,
    deadline: int | None = None,
) -> None:
    now = int(time.time())
    deadline = deadline or now + SESSION_TTL_SECONDS
    max_age = max(0, deadline - now)
    secure = SESSION_COOKIE_SECURE
    if secure is None:
        secure = request.url.scheme == "https"
    common = {
        "httponly": True,
        "secure": secure,
        "samesite": SESSION_COOKIE_SAMESITE,
        "path": "/",
        "max_age": max_age,
    }

    response.set_cookie(ACCESS_COOKIE, session.access_token, **common)
    response.set_cookie(REFRESH_COOKIE, session.refresh_token, **common)
    response.set_cookie(
        DEADLINE_COOKIE,
        _sign_deadline(deadline),
        **common,
    )


def clear_session_cookies(response: Response, request: Request) -> None:
    secure = SESSION_COOKIE_SECURE
    if secure is None:
        secure = request.url.scheme == "https"
    for cookie_name in (ACCESS_COOKIE, REFRESH_COOKIE, DEADLINE_COOKIE):
        response.delete_cookie(
            cookie_name,
            path="/",
            secure=secure,
            httponly=True,
            samesite=SESSION_COOKIE_SAMESITE,
        )


def get_authenticated_user(request: Request, response: Response) -> User:
    access_token = request.cookies.get(ACCESS_COOKIE)
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    deadline = _read_deadline(request.cookies.get(DEADLINE_COOKIE))

    if deadline is None or deadline <= int(time.time()):
        clear_session_cookies(response, request)
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")

    if access_token:
        try:
            auth_response = supabase.auth.get_user(access_token)
            if auth_response and auth_response.user:
                return auth_response.user
        except Exception as error:
            status_code = getattr(error, "status", getattr(error, "status_code", None))
            if status_code not in AUTH_ERROR_STATUSES:
                logger.exception("Could not validate the Supabase access token")
                raise HTTPException(
                    status_code=503,
                    detail="Authentication is temporarily unavailable.",
                ) from error

    if not refresh_token:
        clear_session_cookies(response, request)
        raise HTTPException(status_code=401, detail="Please sign in to continue.")

    try:
        auth_client = create_auth_client()
        refreshed = auth_client.auth.refresh_session(refresh_token)
        if not refreshed.session or not refreshed.user:
            clear_session_cookies(response, request)
            raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")

        set_session_cookies(response, refreshed.session, request, deadline)
        return refreshed.user
    except HTTPException:
        raise
    except Exception as error:
        status_code = getattr(error, "status", getattr(error, "status_code", None))
        if status_code in AUTH_ERROR_STATUSES:
            clear_session_cookies(response, request)
            raise HTTPException(
                status_code=401,
                detail="Your session has expired. Please sign in again.",
            ) from error
        logger.exception("Could not refresh the Supabase session")
        raise HTTPException(
            status_code=503,
            detail="Authentication is temporarily unavailable.",
        ) from error
