# track-your-progress

## Activity types API

`GET /tracker-catalog` returns the signed-in user's activity types, body parts,
and muscle groups together. It requires the session cookies set by `/login`;
each resource is filtered by the authenticated user's ID. The response includes
`body_part_id` on each muscle group to associate it with its body part.

The individual activity-type listing endpoint is replaced by this catalog
endpoint. `POST`, `PATCH`, and `DELETE /activity-types` remain available for
activity-type management.

`POST /activity-types` creates an activity type for the currently signed-in user.
The request must include the session cookies set by `/login`; the server validates
the session and assigns the activity to that user's account. Do not send a
`user_id` in the request.

Request body:

```json
{
  "name": "Swimming",
  "mode": "duration"
}
```

`mode` must be `strength` or `duration`. On success, the endpoint responds with
HTTP `201` and an `activity_type` object containing its `id`, `name`, and `mode`.
Unauthenticated requests receive HTTP `401`.

New accounts are seeded with these body parts in `user_body_parts`: Chest, Back,
Shoulders, Arms, Legs, and Core. Each row receives a unique 8-digit
`user_body_part_id` and the new user's `user_id`. Default muscle groups are also
created in `user_muscle_groups`, linked to the corresponding body-part ID and
owned by that user.

### Edit an activity type

`PATCH /activity-types/{activity_id}` updates one or both fields for the
currently signed-in user. Send only the fields to change:

```json
{
  "name": "Open-water swimming"
}
```

`name` must contain 1–100 characters after trimming, and `mode`, when provided,
must be `strength` or `duration`. The server only updates an activity owned by
the signed-in user; a missing or other user's activity returns HTTP `404`.

### Delete an activity type

`DELETE /activity-types/{activity_id}` deletes the activity type only if it
belongs to the currently signed-in user. It returns HTTP `204` on success and
HTTP `404` if the activity is missing or belongs to someone else. Both
operations require the session cookies set by `/login`.

## Body parts and muscle groups APIs

These endpoints require the signed-in user's session cookies. The server
assigns ownership from the session; clients must not send `user_id`.

- `POST /body-parts` with `{"name": "Mobility"}` creates a body part.
- `PATCH /body-parts/{body_part_id}` with `{"name": "Upper body"}` renames it.
- `DELETE /body-parts/{body_part_id}` deletes it with HTTP `204`. A body part
  that still has muscle groups cannot be deleted; delete those groups first
  (HTTP `409`).
- `POST /muscle-groups` with `{"name": "Quads", "body_part_id": 12345678}`
  creates a group under one of the user's body parts.
- `PATCH /muscle-groups/{muscle_group_id}` accepts `name`, `body_part_id`, or
  both to rename or move a group to another body part owned by the user.
- `DELETE /muscle-groups/{muscle_group_id}` deletes it with HTTP `204`.

Create endpoints return HTTP `201`; update endpoints return the resource with
its ID, name, and (for muscle groups) `body_part_id`. Missing or unowned
resources return HTTP `404`.

## Exercises API

These endpoints require the signed-in user's session cookies. Exercise
ownership is assigned from the session; clients must not send `user_id`.

- `GET /exercises` lists the signed-in user's exercises. Optional query
  parameters `activity_type_id` and `muscle_group_id` filter the results.
  `limit` defaults to 50 (maximum 100), and `offset` defaults to 0 for
  pagination. The response includes `has_more`.
- `POST /exercises` creates an exercise with `name`, optional `description`,
  required `activity_type_id`, and optional `muscle_group_id`.
- `PATCH /exercises/{exercise_id}` accepts one or more of `name`, `description`,
  `activity_type_id`, and `muscle_group_id`. Set `description` or
  `muscle_group_id` to `null` to clear it.
- `DELETE /exercises/{exercise_id}` deletes the exercise and returns HTTP `204`.

Activity types and muscle groups must belong to the signed-in user. A strength
activity requires a muscle group; duration activities may omit it (for example,
a treadmill exercise under Cardio). Create returns HTTP `201`, update returns
the exercise, and missing or unowned resources return HTTP `404`.

## Workouts API

Before deploying duration workout support, apply
[`backend/migrations/20261126_add_duration_workout_metrics.sql`](backend/migrations/20261126_add_duration_workout_metrics.sql)
to the Supabase database. It adds duration and distance columns and
makes strength-only columns nullable for duration entries. The database column
names are `duration` (minutes) and `distance` (kilometres); the API continues
to use `duration_minutes` and `distance_km`.

All endpoints require the signed-in user's session cookies. The API assigns
`user_id` from the session; clients must not send it.

- `POST /workouts` saves a daily workout with strength and/or duration
  activities. Strength exercises contain `mode: "strength"` and one or more
  sets with `weight`, `rep_count`, and `set_number`. Duration exercises contain
  `mode: "duration"`, `duration_minutes`, and optional `distance_km`. Exercises
  must belong to the user and match their activity mode. `/workouts/strength`
  remains as a compatibility alias for strength-only requests.
- `GET /workouts?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` returns the user's
  workout history grouped by date; the range may cover at most 31 days.
- `PUT /workouts/{workout_id}` replaces the full daily workout. The request uses
  the same shape as `POST /workouts`. Moving a workout to a date that already
  has another workout returns HTTP `409`.
- `DELETE /workouts/{workout_id}` removes all set and duration entries in that
  workout.

Example mixed request:

```json
{
  "performed_on": "2026-11-07",
  "exercises": [
    {
      "mode": "strength",
      "user_exercise_id": 12004567,
      "sets": [
        { "set_number": 1, "weight": 10, "rep_count": 10 },
        { "set_number": 2, "weight": 15, "rep_count": 8 }
      ]
    },
    {
      "mode": "duration",
      "user_exercise_id": 12004568,
      "duration_minutes": 30,
      "distance_km": 5.2
    }
  ]
}
```