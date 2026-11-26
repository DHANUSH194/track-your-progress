import logging

from fastapi import APIRouter, HTTPException, Request, Response

from ..models.model import MuscleGroupCreateRequest, MuscleGroupUpdateRequest
from ..services.common import generate_unique_id
from ..services.config import admin_supabase
from ..services.session import get_authenticated_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _require_owned_body_part(body_part_id: int, user_id: str) -> None:
    result = (
        admin_supabase.table("user_body_parts")
        .select("user_body_part_id")
        .eq("user_body_part_id", body_part_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Body part not found.")


@router.post("/muscle-groups", status_code=201)
def create_muscle_group(
    payload: MuscleGroupCreateRequest,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        user_id = str(user.id)
        _require_owned_body_part(payload.body_part_id, user_id)
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Muscle-group name cannot be empty.")

        muscle_group_id = generate_unique_id(
            "user_muscle_groups",
            "user_muscle_group_id",
            set(),
        )
        (
            admin_supabase.table("user_muscle_groups")
            .insert({
                "user_muscle_group_id": muscle_group_id,
                "muscle_group_name": name,
                "user_body_part_id": payload.body_part_id,
                "user_id": user_id,
            })
            .execute()
        )
        return {
            "muscle_group": {
                "id": str(muscle_group_id),
                "name": name,
                "body_part_id": str(payload.body_part_id),
            }
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not create user muscle group")
        raise HTTPException(
            status_code=503,
            detail="Muscle groups are temporarily unavailable.",
        ) from error


@router.patch("/muscle-groups/{muscle_group_id}")
def update_muscle_group(
    muscle_group_id: int,
    payload: MuscleGroupUpdateRequest,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        user_id = str(user.id)
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(
                status_code=422,
                detail="Provide a muscle-group name or body part to update.",
            )

        if "name" in updates:
            name = updates.pop("name")
            if name is None or not name.strip():
                raise HTTPException(
                    status_code=422,
                    detail="Muscle-group name cannot be empty.",
                )
            updates["muscle_group_name"] = name.strip()

        if "body_part_id" in updates:
            body_part_id = updates.pop("body_part_id")
            if body_part_id is None:
                raise HTTPException(status_code=422, detail="Body part cannot be empty.")
            _require_owned_body_part(body_part_id, user_id)
            updates["user_body_part_id"] = body_part_id

        result = (
            admin_supabase.table("user_muscle_groups")
            .update(updates)
            .eq("user_muscle_group_id", muscle_group_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Muscle group not found.")

        row = result.data[0]
        return {
            "muscle_group": {
                "id": str(row["user_muscle_group_id"]),
                "name": row["muscle_group_name"],
                "body_part_id": str(row["user_body_part_id"]),
            }
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not update user muscle group")
        raise HTTPException(
            status_code=503,
            detail="Muscle groups are temporarily unavailable.",
        ) from error


@router.delete("/muscle-groups/{muscle_group_id}", status_code=204)
def delete_muscle_group(
    muscle_group_id: int,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        result = (
            admin_supabase.table("user_muscle_groups")
            .delete()
            .eq("user_muscle_group_id", muscle_group_id)
            .eq("user_id", str(user.id))
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Muscle group not found.")
        return Response(status_code=204)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not delete user muscle group")
        raise HTTPException(
            status_code=503,
            detail="Muscle groups are temporarily unavailable.",
        ) from error
