from datetime import date
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

class SignupRequest(BaseModel):
    email:EmailStr
    password:str
    name:str
    
class LoginRequest(BaseModel):
    username:str
    password:str


class ActivityTypeCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    mode: Literal["strength", "duration"]


class ActivityTypeUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    mode: Literal["strength", "duration"] | None = None


class BodyPartCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class BodyPartUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)


class MuscleGroupCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    body_part_id: int


class MuscleGroupUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    body_part_id: int | None = None


class ExerciseCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    activity_type_id: int
    muscle_group_id: int | None = None


class ExerciseUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    activity_type_id: int | None = None
    muscle_group_id: int | None = None


class StrengthSetCreateRequest(BaseModel):
    weight: float = Field(ge=0, allow_inf_nan=False)
    rep_count: int = Field(ge=1)
    set_number: int = Field(ge=1)


class StrengthExerciseEntryRequest(BaseModel):
    mode: Literal["strength"] = "strength"
    user_exercise_id: int = Field(gt=0)
    sets: list[StrengthSetCreateRequest] = Field(min_length=1, max_length=100)


class DurationExerciseEntryRequest(BaseModel):
    mode: Literal["duration"]
    user_exercise_id: int = Field(gt=0)
    duration_minutes: int = Field(ge=1)
    distance_km: float | None = Field(default=None, ge=0, allow_inf_nan=False)


class StrengthWorkoutCreateRequest(BaseModel):
    performed_on: date
    exercises: list[StrengthExerciseEntryRequest] = Field(min_length=1, max_length=50)


class WorkoutCreateRequest(BaseModel):
    performed_on: date
    exercises: list[StrengthExerciseEntryRequest | DurationExerciseEntryRequest] = Field(
        min_length=1,
        max_length=50,
    )
    