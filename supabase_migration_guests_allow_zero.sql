-- Patch: allow gift_* = 0 (for guests like parents who pay separately and shouldn't count in money stats).
-- Run this AFTER the original guests migration.
-- Floor stays 400 for "real" gifts; 0 is the explicit opt-out marker.

ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_gift_low_check;
ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_gift_realistic_check;
ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_gift_high_check;

ALTER TABLE public.guests ADD CONSTRAINT guests_gift_low_check       CHECK (gift_low = 0       OR gift_low >= 400);
ALTER TABLE public.guests ADD CONSTRAINT guests_gift_realistic_check CHECK (gift_realistic = 0 OR gift_realistic >= 400);
ALTER TABLE public.guests ADD CONSTRAINT guests_gift_high_check      CHECK (gift_high = 0      OR gift_high >= 400);
