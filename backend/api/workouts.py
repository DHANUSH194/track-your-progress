from datetime import date, datetime, timezone
import logging

from fastapi import APIRouter, HTTPException, Request, Response

from ..models.model import (
    DurationExerciseEntryRequest,
    StrengthExerciseEntryRequest,
    StrengthWorkoutCreateRequest,
    WorkoutCreateRequest,
)
from ..services.common import generate_unique_id
from ..services.config import admin_supabase
from ..services.session import get_authenticated_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _validate_workout_exercises(
    user_id: str,
    payload: StrengthWorkoutCreateRequest | WorkoutCreateRequest,
) -> None:
    strength_exercise_ids = [
        exercise.user_exercise_id
        for exercise in payload.exercises
        if isinstance(exercise, StrengthExerciseEntryRequest)
    ]
    if len(set(strength_exercise_ids)) != len(strength_exercise_ids):
        raise HTTPException(
            status_code=422,
            detail="Each exercise can appear only once in a workout request.",
        )
    exercise_ids = list({exercise.user_exercise_id for exercise in payload.exercises})

    exercise_result = (
        admin_supabase.table("user_exercises")
        .select("user_exercise_id, user_activity_id")
        .eq("user_id", user_id)
        .in_("user_exercise_id", exercise_ids)
        .execute()
    )
    owned_exercises = {
        row["user_exercise_id"]: row["user_activity_id"]
        for row in exercise_result.data or []
    }
    if len(owned_exercises) != len(exercise_ids):
        raise HTTPException(status_code=404, detail="Exercise not found.")

    activity_ids = list(set(owned_exercises.values()))
    activity_result = (
        admin_supabase.table("user_activity_types")
        .select("user_activity_id, tracking_mode")
        .eq("user_id", user_id)
        .in_("user_activity_id", activity_ids)
        .execute()
    )
    activity_modes = {
        row["user_activity_id"]: row["tracking_mode"]
        for row in activity_result.data or []
    }
    for exercise in payload.exercises:
        expected_mode = "strength" if isinstance(exercise, StrengthExerciseEntryRequest) else "duration"
        if activity_modes.get(owned_exercises[exercise.user_exercise_id]) != expected_mode:
            raise HTTPException(
                status_code=422,
                detail=f"Exercise must be linked to a {expected_mode} activity.",
            )


def _build_workout_rows(
    user_id: str,
    workout_id: int,
    payload: StrengthWorkoutCreateRequest | WorkoutCreateRequest,
) -> list[dict]:
    created_at = datetime.now(timezone.utc).isoformat()
    entry_ids: set[int] = set()
    rows = []
    for exercise in payload.exercises:
        if isinstance(exercise, StrengthExerciseEntryRequest):
            set_numbers = [item.set_number for item in exercise.sets]
            if len(set(set_numbers)) != len(set_numbers):
                raise HTTPException(
                    status_code=422,
                    detail="Set numbers must be unique for each exercise.",
                )
            exercise_entries = [
                {
                    "weight": strength_set.weight,
                    "rep_count": strength_set.rep_count,
                    "set_number": strength_set.set_number,
                    "duration": None,
                    "distance": None,
                }
                for strength_set in exercise.sets
            ]
        elif isinstance(exercise, DurationExerciseEntryRequest):
            exercise_entries = [{
                "weight": None,
                "rep_count": None,
                "set_number": None,
                "duration": exercise.duration_minutes,
                "distance": exercise.distance_km,
            }]

        for entry in exercise_entries:
            rows.append({
                "workout_entry_id": generate_unique_id(
                    "user_workouts",
                    "workout_entry_id",
                    entry_ids,
                ),
                "workout_id": workout_id,
                "created_at": created_at,
                "performed_on": payload.performed_on.isoformat(),
                "user_id": user_id,
                "user_exercise_id": exercise.user_exercise_id,
                **entry,
            })
    return rows


def _workout_response(workout_id: int, rows: list[dict]) -> dict:
    return {
        "workout_id": str(workout_id),
        "entries": [
            {
                "workout_entry_id": str(row["workout_entry_id"]),
                "workout_id": str(row["workout_id"]),
                "created_at": row["created_at"],
                "performed_on": str(row["performed_on"]),
                "user_exercise_id": str(row["user_exercise_id"]),
                "weight": row["weight"],
                "rep_count": row["rep_count"],
                "set_number": row["set_number"],
                "duration_minutes": row["duration"],
                "distance_km": row["distance"],
            }
            for row in rows
        ],
    }


@router.get("/workouts")
def get_workouts(
    start_date: date,
    end_date: date,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        if start_date > end_date:
            raise HTTPException(
                status_code=422,
                detail="The start date must be on or before the end date.",
            )
        if (end_date - start_date).days > 30:
            raise HTTPException(
                status_code=422,
                detail="Workout history can be requested for at most 31 days.",
            )

        result = (
            admin_supabase.table("user_workouts")
            .select(
                "workout_entry_id, user_exercise_id, performed_on, created_at, "
                "weight, rep_count, set_number, duration, distance"
            )
            .eq("user_id", str(user.id))
            .gte("performed_on", start_date.isoformat())
            .lte("performed_on", end_date.isoformat())
            .execute()
        )
        rows = result.data or []
        if not rows:
            return {"days": []}

        exercise_ids = list({row["user_exercise_id"] for row in rows})
        exercise_result = (
            admin_supabase.table("user_exercises")
            .select("user_exercise_id, exercise_name, user_activity_id")
            .eq("user_id", str(user.id))
            .in_("user_exercise_id", exercise_ids)
            .execute()
        )
        exercises = {
            row["user_exercise_id"]: row
            for row in exercise_result.data or []
        }
        activity_ids = list({
            row["user_activity_id"]
            for row in exercises.values()
        })
        activity_result = (
            admin_supabase.table("user_activity_types")
            .select("user_activity_id, activity_name")
            .eq("user_id", str(user.id))
            .in_("user_activity_id", activity_ids)
            .execute()
        ) if activity_ids else None
        activity_rows = []
        if activity_result is not None:
            activity_rows = activity_result.data or []
        activity_names = {
            row["user_activity_id"]: row["activity_name"]
            for row in activity_rows
        }

        rows.sort(key=lambda row: (
            str(row["performed_on"]),
            str(row["created_at"]),
            int(row["set_number"] or 0),
        ))
        days: dict[str, dict[str, dict]] = {}
        for row in rows:
            performed_on = str(row["performed_on"])
            exercise_id = row["user_exercise_id"]
            exercise = exercises.get(exercise_id, {})
            exercise_key = str(exercise_id)
            mode = "strength" if row["weight"] is not None else "duration"
            day = days.setdefault(performed_on, {"performed_on": performed_on, "exercises": {}})
            day_exercises = day["exercises"]
            day_exercise = day_exercises.setdefault(exercise_key, {
                "user_exercise_id": exercise_key,
                "name": exercise.get("exercise_name", f"Exercise {exercise_key}"),
                "activity_name": activity_names.get(exercise.get("user_activity_id")),
                "mode": mode,
                "entries": [],
            })
            if mode == "strength":
                day_exercise["entries"].append({
                    "mode": mode,
                    "weight": float(row["weight"]),
                    "rep_count": int(row["rep_count"]),
                    "set_number": int(row["set_number"]),
                })
            else:
                day_exercise["entries"].append({
                    "mode": mode,
                    "duration_minutes": int(row["duration"]),
                    "distance_km": (
                        float(row["distance"])
                        if row["distance"] is not None
                        else None
                    ),
                })

        return {
            "days": [
                {
                    "performed_on": performed_on,
                    "exercises": list(day["exercises"].values()),
                }
                for performed_on, day in sorted(days.items(), reverse=True)
            ],
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not load workout history")
        raise HTTPException(
            status_code=503,
            detail="Workout history is temporarily unavailable.",
        ) from error


@router.get("/workouts/prs")
def get_workout_personal_records(request: Request, response: Response):
    try:
        user = get_authenticated_user(request, response)
        result = (
            admin_supabase.table("user_workouts")
            .select("user_exercise_id, weight, rep_count, performed_on")
            .eq("user_id", str(user.id))
            .execute()
        )

        records: dict[tuple[int, str], tuple[int | float, str]] = {}
        for row in result.data or []:
            if row["weight"] is None or row["rep_count"] is None:
                continue
            exercise_id = int(row["user_exercise_id"])
            weight = float(row["weight"])
            metric = "weight" if weight > 0 else "reps"
            value = weight if metric == "weight" else int(row["rep_count"])
            key = (exercise_id, metric)
            existing = records.get(key)
            if existing is None or value > existing[0]:
                records[key] = (value, str(row["performed_on"]))

        return {
            "records": [
                {
                    "user_exercise_id": str(exercise_id),
                    "metric": metric,
                    "value": value,
                    "performed_on": performed_on,
                }
                for (exercise_id, metric), (value, performed_on) in records.items()
            ],
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not load workout personal records")
        raise HTTPException(
            status_code=503,
            detail="Workout personal records are temporarily unavailable.",
        ) from error


@router.post("/workouts/strength", status_code=201, include_in_schema=False)
@router.post("/workouts", status_code=201)
def create_workout(
    payload: WorkoutCreateRequest,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        user_id = str(user.id)
        _validate_workout_exercises(user_id, payload)

        existing_workout_result = (
            admin_supabase.table("user_workouts")
            .select("workout_id")
            .eq("user_id", user_id)
            .eq("performed_on", payload.performed_on.isoformat())
            .limit(1)
            .execute()
        )
        existing_workout_id = (
            existing_workout_result.data[0]["workout_id"]
            if existing_workout_result.data
            else None
        )
        workout_id = existing_workout_id or generate_unique_id(
            "user_workouts",
            "workout_id",
            set(),
        )
        rows = _build_workout_rows(user_id, workout_id, payload)

        result = admin_supabase.table("user_workouts").insert(rows).execute()
        inserted_rows = result.data or rows
        return _workout_response(workout_id, inserted_rows)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not save workout")
        raise HTTPException(
            status_code=503,
            detail="Workouts are temporarily unavailable.",
        ) from error


@router.put("/workouts/{workout_id}")
def replace_workout(
    workout_id: int,
    payload: WorkoutCreateRequest,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        user_id = str(user.id)
        existing_result = (
            admin_supabase.table("user_workouts")
            .select("workout_entry_id, performed_on")
            .eq("user_id", user_id)
            .eq("workout_id", workout_id)
            .execute()
        )
        existing_rows = existing_result.data or []
        if not existing_rows:
            raise HTTPException(status_code=404, detail="Workout not found.")

        original_dates = {str(row["performed_on"]) for row in existing_rows}
        new_performed_on = payload.performed_on.isoformat()
        if new_performed_on not in original_dates:
            conflicting_workout = (
                admin_supabase.table("user_workouts")
                .select("workout_id")
                .eq("user_id", user_id)
                .eq("performed_on", new_performed_on)
                .neq("workout_id", workout_id)
                .limit(1)
                .execute()
            )
            if conflicting_workout.data:
                raise HTTPException(
                    status_code=409,
                    detail="A workout already exists on that date. Edit that daily workout instead.",
                )

        _validate_workout_exercises(user_id, payload)
        replacement_rows = _build_workout_rows(user_id, workout_id, payload)
        inserted_result = (
            admin_supabase.table("user_workouts")
            .insert(replacement_rows)
            .execute()
        )
        inserted_rows = inserted_result.data or replacement_rows

        old_entry_ids = [row["workout_entry_id"] for row in existing_rows]
        try:
            (
                admin_supabase.table("user_workouts")
                .delete()
                .eq("user_id", user_id)
                .eq("workout_id", workout_id)
                .in_("workout_entry_id", old_entry_ids)
                .execute()
            )
        except Exception as error:
            logger.exception(
                "Inserted replacement rows but could not remove old workout entries"
            )
            raise HTTPException(
                status_code=503,
                detail=(
                    "Replacement sets were saved, but old sets could not be removed. "
                    "Refresh workout history before retrying."
                ),
            ) from error

        return _workout_response(workout_id, inserted_rows)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not replace workout")
        raise HTTPException(
            status_code=503,
            detail="Workouts are temporarily unavailable.",
        ) from error


@router.delete("/workouts/{workout_id}")
def delete_workout(
    workout_id: int,
    request: Request,
    response: Response,
):
    try:
        user = get_authenticated_user(request, response)
        user_id = str(user.id)
        existing_result = (
            admin_supabase.table("user_workouts")
            .select("workout_entry_id")
            .eq("user_id", user_id)
            .eq("workout_id", workout_id)
            .execute()
        )
        existing_rows = existing_result.data or []
        if not existing_rows:
            raise HTTPException(status_code=404, detail="Workout not found.")

        (
            admin_supabase.table("user_workouts")
            .delete()
            .eq("user_id", user_id)
            .eq("workout_id", workout_id)
            .execute()
        )
        remaining_result = (
            admin_supabase.table("user_workouts")
            .select("workout_entry_id")
            .eq("user_id", user_id)
            .eq("workout_id", workout_id)
            .limit(1)
            .execute()
        )
        if remaining_result.data:
            raise HTTPException(
                status_code=503,
                detail="Could not delete every set in the workout.",
            )
        return {
            "workout_id": str(workout_id),
            "deleted_entries": len(existing_rows),
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not delete workout")
        raise HTTPException(
            status_code=503,
            detail="Workouts are temporarily unavailable.",
        ) from error
