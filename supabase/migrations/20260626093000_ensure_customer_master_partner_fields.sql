-- Ensure customer partner/tax fields exist in environments that missed the original migration.
ALTER TABLE public.customer_master
  ADD COLUMN IF NOT EXISTS partner_category text,
  ADD COLUMN IF NOT EXISTS corporate_registration_number text,
  ADD COLUMN IF NOT EXISTS ceo_name text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS business_item text,
  ADD COLUMN IF NOT EXISTS tax_invoice_email text,
  ADD COLUMN IF NOT EXISTS settlement_manager_name text,
  ADD COLUMN IF NOT EXISTS settlement_manager_phone text,
  ADD COLUMN IF NOT EXISTS settlement_basis_memo text,
  ADD COLUMN IF NOT EXISTS invoice_available_status text,
  ADD COLUMN IF NOT EXISTS business_license_storage_path text,
  ADD COLUMN IF NOT EXISTS bankbook_storage_path text,
  ADD COLUMN IF NOT EXISTS contract_storage_path text,
  ADD COLUMN IF NOT EXISTS domestic_overseas_type text,
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS has_business_license_document boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_bankbook_document boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_contract_document boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS contact_status text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS fax_number text,
  ADD COLUMN IF NOT EXISTS website_url text;

ALTER TABLE public.customer_master DROP CONSTRAINT IF EXISTS customer_master_partner_category_check;
ALTER TABLE public.customer_master ADD CONSTRAINT customer_master_partner_category_check
  CHECK (
    partner_category IS NULL
    OR partner_category = ANY (ARRAY['CUSTOMER'::text, 'SUPPLIER'::text, 'CARRIER'::text, 'OTHER'::text])
  );

ALTER TABLE public.customer_master DROP CONSTRAINT IF EXISTS customer_master_invoice_available_status_check;
ALTER TABLE public.customer_master ADD CONSTRAINT customer_master_invoice_available_status_check
  CHECK (
    invoice_available_status IS NULL
    OR invoice_available_status = ANY (ARRAY['AVAILABLE'::text, 'UNAVAILABLE'::text, 'NEEDS_REVIEW'::text])
  );

ALTER TABLE public.customer_master DROP CONSTRAINT IF EXISTS customer_master_domestic_overseas_type_check;
ALTER TABLE public.customer_master ADD CONSTRAINT customer_master_domestic_overseas_type_check
  CHECK (
    domestic_overseas_type IS NULL
    OR domestic_overseas_type = ANY (ARRAY['DOMESTIC'::text, 'OVERSEAS'::text])
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_master_tenant_business_reg_no
  ON public.customer_master (tenant_id, business_reg_no)
  WHERE business_reg_no IS NOT NULL AND length(trim(business_reg_no)) = 10;

UPDATE public.customer_master
SET invoice_available_status = 'NEEDS_REVIEW'
WHERE invoice_available_status IS NULL;

NOTIFY pgrst, 'reload schema';
