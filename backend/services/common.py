import secrets

from fastapi import HTTPException
from .config import admin_supabase


def generate_unique_id(
    table_name: str,
    id_column: str,
    existing_ids: set[int],
) -> int:
    for _ in range(10):
        record_id = secrets.randbelow(90_000_000) + 10_000_000
        if record_id in existing_ids:
            continue
        result = (
            admin_supabase.table(table_name)
            .select(id_column)
            .eq(id_column, record_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            existing_ids.add(record_id)
            return record_id
    raise HTTPException(
        status_code=503,
        detail=f"Could not allocate a unique ID for {table_name}. Please try again.",
    )