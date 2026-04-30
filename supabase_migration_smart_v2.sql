-- Run-sheet support: per-vendor day-of-event payment + arrival info
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'מזומן';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_holder text DEFAULT '';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS arrival_time text DEFAULT '';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_ready boolean DEFAULT false;

-- Track who paid the advance (Nadav / Lital / shared)
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS advance_paid_by text DEFAULT '';

-- Editable run-sheet events stored as JSON on the wedding config
ALTER TABLE public.wedding_config ADD COLUMN IF NOT EXISTS run_sheet_events jsonb DEFAULT '[]'::jsonb;
