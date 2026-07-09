-- Optional backfill script.
-- Run manually only when you want to initialize 업체명(상호명) from the existing internal 거래처명.
UPDATE public.customer_master
SET company_name = name,
    updated_at = now()
WHERE company_name IS NULL
  AND name IS NOT NULL;

NOTIFY pgrst, 'reload schema';
