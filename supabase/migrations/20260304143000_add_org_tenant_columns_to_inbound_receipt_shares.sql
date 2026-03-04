BEGIN;

ALTER TABLE public.inbound_receipt_shares
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.inbound_receipt_shares s
SET
  org_id = COALESCE(s.org_id, r.org_id),
  tenant_id = COALESCE(s.tenant_id, r.org_id)
FROM public.inbound_receipts r
WHERE s.receipt_id = r.id
  AND (s.org_id IS NULL OR s.tenant_id IS NULL);

CREATE INDEX IF NOT EXISTS inbound_receipt_shares_org_id_idx
  ON public.inbound_receipt_shares(org_id);

CREATE INDEX IF NOT EXISTS inbound_receipt_shares_tenant_id_idx
  ON public.inbound_receipt_shares(tenant_id);

COMMIT;

NOTIFY pgrst, 'reload schema';
