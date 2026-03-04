BEGIN;

DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.inbound_receipt_shares;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.inbound_receipt_shares;

CREATE POLICY "Enable all access for authenticated users"
ON public.inbound_receipt_shares
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

COMMIT;

NOTIFY pgrst, 'reload schema';
