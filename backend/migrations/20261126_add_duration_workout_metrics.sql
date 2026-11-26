ALTER TABLE public.user_workouts
    ADD COLUMN IF NOT EXISTS duration integer,
    ADD COLUMN IF NOT EXISTS distance numeric;

ALTER TABLE public.user_workouts
    ALTER COLUMN weight DROP NOT NULL,
    ALTER COLUMN rep_count DROP NOT NULL,
    ALTER COLUMN set_number DROP NOT NULL;
