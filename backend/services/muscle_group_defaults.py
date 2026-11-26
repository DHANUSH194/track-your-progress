from .common import generate_unique_id
from .config import admin_supabase

MUSCLE_GROUP_DEFAULTS = {
    "Chest": ("Upper chest", "Mid chest", "Lower chest"),
    "Back": ("Lats", "Traps", "Rhomboids", "Lower back"),
    "Shoulders": ("Front delts", "Side delts", "Rear delts"),
    "Arms": ("Biceps", "Triceps", "Forearms"),
    "Legs": ("Quads", "Hamstrings", "Glutes", "Calves", "Adductors"),
    "Core": ("Abs", "Obliques", "Lower back"),
}


def create_default_muscle_groups(
    user_id: str,
    body_part_ids: dict[str, int],
) -> None:
    missing_body_parts = set(MUSCLE_GROUP_DEFAULTS) - body_part_ids.keys()
    if missing_body_parts:
        missing_names = ", ".join(sorted(missing_body_parts))
        raise ValueError(f"Missing body-part IDs for default muscle groups: {missing_names}")

    existing_ids: set[int] = set()
    muscle_groups = [
        {
            "user_muscle_group_id": generate_unique_id(
                "user_muscle_groups",
                "user_muscle_group_id",
                existing_ids,
            ),
            "muscle_group_name": muscle_group_name,
            "user_body_part_id": body_part_ids[body_part_name],
            "user_id": user_id,
        }
        for body_part_name, muscle_group_names in MUSCLE_GROUP_DEFAULTS.items()
        for muscle_group_name in muscle_group_names
    ]
    admin_supabase.table("user_muscle_groups").insert(muscle_groups).execute()
