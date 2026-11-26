from .common import generate_unique_id
from .config import admin_supabase

BODY_PART_DEFAULTS = (
    "Chest",
    "Back",
    "Shoulders",
    "Arms",
    "Legs",
    "Core",
)


def create_default_body_parts(user_id: str) -> dict[str, int]:
    existing_ids: set[int] = set()
    body_parts = [
        {
            "user_body_part_id": generate_unique_id(
                "user_body_parts",
                "user_body_part_id",
                existing_ids,
            ),
            "user_id": user_id,
            "body_part_name": body_part_name,
        }
        for body_part_name in BODY_PART_DEFAULTS
    ]
    admin_supabase.table("user_body_parts").insert(body_parts).execute()
    return {
        body_part["body_part_name"]: body_part["user_body_part_id"]
        for body_part in body_parts
    }
