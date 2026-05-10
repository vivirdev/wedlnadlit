-- RSVP status per guest. Lets the user override category-based attendance defaults
-- with an explicit "I asked them" signal: confirmed / doubtful / declined.
-- The app keeps attendance_prob in sync (1.0 / 0.5 / 0.0 / category default) — the
-- column here is the source of truth for *intent*, attendance_prob is the number we
-- multiply into the gift forecast.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS rsvp_status text;

ALTER TABLE public.guests
  DROP CONSTRAINT IF EXISTS guests_rsvp_status_check;

ALTER TABLE public.guests
  ADD CONSTRAINT guests_rsvp_status_check
  CHECK (rsvp_status IS NULL OR rsvp_status IN ('confirmed', 'doubtful', 'declined'));
