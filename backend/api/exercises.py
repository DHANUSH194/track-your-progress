import logging

from fastapi import APIRouter, HTTPException, Query, Request, Response

from ..models.model import ExerciseCreateRequest, ExerciseUpdateRequest
from ..services.common import generate_unique_id
from ..services.config import admin_supabase
from ..services.session import get_authenticated_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_owned_activity_mode(activity_type_id: int, user_id: str) -> str:
    result = (
        admin_supabase.table("user_activity_types")
        .select("tracking_mode")
        .eq("user_activity_id", activity_type_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Activity type not found.")
    return result.data[0]["tracking_mode"]


def _require_owned_muscle_group(muscle_group_id: int, user_id: str) -> None:
    result = (
        admin_supabase.table("user_muscle_groups")
        .select("user_muscle_group_id")
        .eq("user_muscle_group_id", muscle_group_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Muscle group not found.")


def _normalize_description(description: str | None) -> str | None:
    if description is None:
        return None
    return description.strip() or None


def _exercise_response(row: dict) -> dict:
    return {
        "id": str(row["user_exercise_id"]),
        "name": row["exercise_name"],
        "description": row.get("description"),
        "activity_type_id": str(row["user_activity_id"]),
        "muscle_group_id": (
            str(row["user_muscle_group_id"])
            if row.get("user_muscle_group_id") is not None
            else None
        ),
    }


@router.get("/exercises")
def get_exercises(
    request: Request,
    response: Response,
    activity_type_id: int | None = None,
    muscle_group_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    try:
        user = get_authenticated_user(request, response)
        user_id = str(user.id)
        if activity_type_id is not None:
            _get_owned_activity_mode(activity_type_id, user_id)
        if muscle_group_id is not None:
            _require_owned_muscle_group(muscle_group_id, user_id)

        query = (
            admin_supabase.table("user_exercises")
            .select(
                "user_exercise_id, exercise_name, description, "
                "user_activity_id, user_muscle_group_id"
            )
            .eq("user_id", user_id)
        )
        if activity_type_id is not None:
            query = query.eq("user_activity_id", activity_type_id)
        if muscle_group_id is not None:
            query = query.eq("user_muscle_group_id", muscle_group_id)

        result = (
            query.order("exercise_name")
            .range(offset, offset + limit)
            .execute()
        )
        rows = result.data or []
        has_more = len(rows) > limit
        return {
            "exercises": [_exercise_response(row) for row in rows[:limit]],
            "limit": limit,
            "offset": offset,
            "has_more": has_more,
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not load user exercises")
        raise HTTPException(
            status_code=503,
            detail="Exercises are temporarily unavailable.",
        ) from error


@router.post("/exercises", status_code=201)
def create_exercise(
    payload: ExerciseCreateRequest,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        user_id = str(user.id)
        activity_mode = _get_owned_activity_mode(payload.activity_type_id, user_id)
        if payload.muscle_group_id is not None:
            _require_owned_muscle_group(payload.muscle_group_id, user_id)
        elif activity_mode == "strength":
            raise HTTPException(
                status_code=422,
                detail="Strength exercises must belong to a muscle group.",
            )

        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Exercise name cannot be empty.")

        exercise_id = generate_unique_id(
            "user_exercises",
            "user_exercise_id",
            set(),
        )
        description = _normalize_description(payload.description)
        result = (
            admin_supabase.table("user_exercises")
            .insert({
                "user_exercise_id": exercise_id,
                "exercise_name": name,
                "description": description,
                "user_id": user_id,
                "user_activity_id": payload.activity_type_id,
                "user_muscle_group_id": payload.muscle_group_id,
            })
            .execute()
        )
        row = result.data[0] if result.data else {
            "user_exercise_id": exercise_id,
            "exercise_name": name,
            "description": description,
            "user_activity_id": payload.activity_type_id,
            "user_muscle_group_id": payload.muscle_group_id,
        }
        return {"exercise": _exercise_response(row)}
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not create user exercise")
        raise HTTPException(
            status_code=503,
            detail="Exercises are temporarily unavailable.",
        ) from error


@router.patch("/exercises/{exercise_id}")
def update_exercise(
    exercise_id: int,
    payload: ExerciseUpdateRequest,
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
                detail="Provide at least one exercise field to update.",
            )

        current_result = (
            admin_supabase.table("user_exercises")
            .select(
                "user_exercise_id, user_activity_id, user_muscle_group_id"
            )
            .eq("user_exercise_id", exercise_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not current_result.data:
            raise HTTPException(status_code=404, detail="Exercise not found.")
        current = current_result.data[0]

        activity_type_id = updates.pop("activity_type_id", current["user_activity_id"])
        muscle_group_id = updates.pop(
            "muscle_group_id",
            current["user_muscle_group_id"],
        )
        if activity_type_id is None:
            raise HTTPException(status_code=422, detail="Activity type cannot be empty.")
        activity_mode = _get_owned_activity_mode(activity_type_id, user_id)
        if muscle_group_id is not None:
            _require_owned_muscle_group(muscle_group_id, user_id)
        elif activity_mode == "strength":
            raise HTTPException(
                status_code=422,
                detail="Strength exercises must belong to a muscle group.",
            )

        if "name" in updates:
            name = updates.pop("name")
            if name is None or not name.strip():
                raise HTTPException(status_code=422, detail="Exercise name cannot be empty.")
            updates["exercise_name"] = name.strip()
        if "description" in updates:
            updates["description"] = _normalize_description(updates["description"])

        updates["user_activity_id"] = activity_type_id
        updates["user_muscle_group_id"] = muscle_group_id
        result = (
            admin_supabase.table("user_exercises")
            .update(updates)
            .eq("user_exercise_id", exercise_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Exercise not found.")
        return {"exercise": _exercise_response(result.data[0])}
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not update user exercise")
        raise HTTPException(
            status_code=503,
            detail="Exercises are temporarily unavailable.",
        ) from error


@router.delete("/exercises/{exercise_id}", status_code=204)
def delete_exercise(
    exercise_id: int,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        result = (
            admin_supabase.table("user_exercises")
            .delete()
            .eq("user_exercise_id", exercise_id)
            .eq("user_id", str(user.id))
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Exercise not found.")
        return Response(status_code=204)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not delete user exercise")
        raise HTTPException(
            status_code=503,
            detail="Exercises are temporarily unavailable.",
        ) from error
