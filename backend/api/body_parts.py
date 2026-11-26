import logging

from fastapi import APIRouter, HTTPException, Request, Response

from ..models.model import BodyPartCreateRequest, BodyPartUpdateRequest
from ..services.common import generate_unique_id
from ..services.config import admin_supabase
from ..services.session import get_authenticated_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/body-parts", status_code=201)
def create_body_part(
    payload: BodyPartCreateRequest,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Body-part name cannot be empty.")

        body_part_id = generate_unique_id(
            "user_body_parts",
            "user_body_part_id",
            set(),
        )
        (
            admin_supabase.table("user_body_parts")
            .insert({
                "user_body_part_id": body_part_id,
                "body_part_name": name,
                "user_id": str(user.id),
            })
            .execute()
        )
        return {"body_part": {"id": str(body_part_id), "name": name}}
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not create user body part")
        raise HTTPException(
            status_code=503,
            detail="Body parts are temporarily unavailable.",
        ) from error


@router.patch("/body-parts/{body_part_id}")
def update_body_part(
    body_part_id: int,
    payload: BodyPartUpdateRequest,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(
                status_code=422,
                detail="Provide a body-part name to update.",
            )

        name = updates.get("name")
        if name is None or not name.strip():
            raise HTTPException(status_code=422, detail="Body-part name cannot be empty.")
        updates["body_part_name"] = name.strip()
        del updates["name"]

        result = (
            admin_supabase.table("user_body_parts")
            .update(updates)
            .eq("user_body_part_id", body_part_id)
            .eq("user_id", str(user.id))
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Body part not found.")

        row = result.data[0]
        return {
            "body_part": {
                "id": str(row["user_body_part_id"]),
                "name": row["body_part_name"],
            }
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not update user body part")
        raise HTTPException(
            status_code=503,
            detail="Body parts are temporarily unavailable.",
        ) from error


@router.delete("/body-parts/{body_part_id}", status_code=204)
def delete_body_part(
    body_part_id: int,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        body_part = (
            admin_supabase.table("user_body_parts")
            .select("user_body_part_id")
            .eq("user_body_part_id", body_part_id)
            .eq("user_id", str(user.id))
            .limit(1)
            .execute()
        )
        if not body_part.data:
            raise HTTPException(status_code=404, detail="Body part not found.")

        muscle_groups = (
            admin_supabase.table("user_muscle_groups")
            .select("user_muscle_group_id")
            .eq("user_body_part_id", body_part_id)
            .eq("user_id", str(user.id))
            .limit(1)
            .execute()
        )
        if muscle_groups.data:
            raise HTTPException(
                status_code=409,
                detail="Delete this body part's muscle groups before deleting the body part.",
            )

        result = (
            admin_supabase.table("user_body_parts")
            .delete()
            .eq("user_body_part_id", body_part_id)
            .eq("user_id", str(user.id))
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Body part not found.")
        return Response(status_code=204)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not delete user body part")
        raise HTTPException(
            status_code=503,
            detail="Body parts are temporarily unavailable.",
        ) from error
