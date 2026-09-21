BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS customer_master_id uuid REFERENCES public.customer_master(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_profiles_customer_master_id_idx
  ON public.user_profiles(customer_master_id);

COMMIT;
