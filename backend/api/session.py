from fastapi import APIRouter, HTTPException, Request, Response

from ..services.session import clear_session_cookies, get_authenticated_user

router = APIRouter()


@router.get("/session")
def get_session(request: Request, response: Response):
    user = get_authenticated_user(request, response)
    if not user.email:
        raise HTTPException(status_code=401, detail="The signed-in account has no email address.")
    return {"email": user.email}


@router.post("/logout")
def logout(request: Request, response: Response):
    clear_session_cookies(response, request)
    return {"message": "Signed out."}
