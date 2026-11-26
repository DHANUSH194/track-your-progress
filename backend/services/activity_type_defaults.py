from .common import generate_unique_id
from .config import admin_supabase

ACTIVITY_TYPE_DEFAULTS = (
    ("Strength training", "strength"),
    ("Stretching", "duration"),
    ("Cardio", "duration"),
)


def create_default_activity_types(user_id: str) -> None:
    existing_ids: set[int] = set()
    admin_supabase.table("user_activity_types").insert([
        {
            "user_activity_id": generate_unique_id(
                "user_activity_types",
                "user_activity_id",
                existing_ids,
            ),
            "user_id": user_id,
            "activity_name": activity_name,
            "tracking_mode": tracking_mode,
        }
        for activity_name, tracking_mode in ACTIVITY_TYPE_DEFAULTS
    ]).execute()