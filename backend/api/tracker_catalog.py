import logging

from fastapi import APIRouter, HTTPException, Request, Response

from ..services.config import admin_supabase
from ..services.session import get_authenticated_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/tracker-catalog")
def get_tracker_catalog(request: Request, response: Response):
    try:
        user = get_authenticated_user(request, response)
        user_id = str(user.id)

        activity_result = (
            admin_supabase.table("user_activity_types")
            .select("user_activity_id, activity_name, tracking_mode")
            .eq("user_id", user_id)
            .order("activity_name")
            .execute()
        )
        body_part_result = (
            admin_supabase.table("user_body_parts")
            .select("user_body_part_id, body_part_name")
            .eq("user_id", user_id)
            .order("body_part_name")
            .execute()
        )
        muscle_group_result = (
            admin_supabase.table("user_muscle_groups")
            .select("user_muscle_group_id, muscle_group_name, user_body_part_id")
            .eq("user_id", user_id)
            .order("muscle_group_name")
            .execute()
        )

        return {
            "activity_types": [
                {
                    "id": str(row["user_activity_id"]),
                    "name": row["activity_name"],
                    "mode": row["tracking_mode"],
                }
                for row in activity_result.data or []
            ],
            "body_parts": [
                {
                    "id": str(row["user_body_part_id"]),
                    "name": row["body_part_name"],
                }
                for row in body_part_result.data or []
            ],
            "muscle_groups": [
                {
                    "id": str(row["user_muscle_group_id"]),
                    "name": row["muscle_group_name"],
                    "body_part_id": str(row["user_body_part_id"]),
                }
                for row in muscle_group_result.data or []
            ],
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not load user tracker catalog")
        raise HTTPException(
            status_code=503,
            detail="Your tracker catalog is temporarily unavailable.",
        ) from error
