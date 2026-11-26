import logging

from fastapi import APIRouter, HTTPException, Request, Response

from ..models.model import ActivityTypeCreateRequest, ActivityTypeUpdateRequest
from ..services.common import generate_unique_id
from ..services.config import admin_supabase
from ..services.session import get_authenticated_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/activity-types", status_code=201)
def create_activity_type(
    payload: ActivityTypeCreateRequest,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        activity_name = payload.name.strip()
        if not activity_name:
            raise HTTPException(
                status_code=422,
                detail="Activity name cannot be empty.",
            )

        activity_id = generate_unique_id(
            "user_activity_types",
            "user_activity_id",
            set(),
        )
        (
            admin_supabase.table("user_activity_types")
            .insert({
                "user_activity_id": activity_id,
                "user_id": str(user.id),
                "activity_name": activity_name,
                "tracking_mode": payload.mode,
            })
            .execute()
        )
        return {
            "activity_type": {
                "id": str(activity_id),
                "name": activity_name,
                "mode": payload.mode,
            }
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not create user activity type")
        raise HTTPException(
            status_code=503,
            detail="Activity types are temporarily unavailable.",
        ) from error


@router.patch("/activity-types/{activity_id}")
def update_activity_type(
    activity_id: int,
    payload: ActivityTypeUpdateRequest,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(
                status_code=422,
                detail="Provide at least one activity field to update.",
            )

        if "name" in updates:
            activity_name = updates.pop("name")
            if activity_name is None or not activity_name.strip():
                raise HTTPException(
                    status_code=422,
                    detail="Activity name cannot be empty.",
                )
            updates["activity_name"] = activity_name.strip()

        if "mode" in updates:
            tracking_mode = updates.pop("mode")
            if tracking_mode is None:
                raise HTTPException(
                    status_code=422,
                    detail="Activity mode cannot be empty.",
                )
            updates["tracking_mode"] = tracking_mode

        result = (
            admin_supabase.table("user_activity_types")
            .update(updates)
            .eq("user_activity_id", activity_id)
            .eq("user_id", str(user.id))
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Activity type not found.")

        row = result.data[0]
        return {
            "activity_type": {
                "id": str(row["user_activity_id"]),
                "name": row["activity_name"],
                "mode": row["tracking_mode"],
            }
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not update user activity type")
        raise HTTPException(
            status_code=503,
            detail="Activity types are temporarily unavailable.",
        ) from error


@router.delete("/activity-types/{activity_id}", status_code=204)
def delete_activity_type(
    activity_id: int,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        result = (
            admin_supabase.table("user_activity_types")
            .delete()
            .eq("user_activity_id", activity_id)
            .eq("user_id", str(user.id))
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Activity type not found.")
        return Response(status_code=204)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not delete user activity type")
        raise HTTPException(
            status_code=503,
            detail="Activity types are temporarily unavailable.",
        ) from error
