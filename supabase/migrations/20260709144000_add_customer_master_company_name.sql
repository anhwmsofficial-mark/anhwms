-- 업체명(상호명): 실제 사업자등록증 또는 고객이 사용하는 공식 상호.
-- 기존 customer_master.name(거래처명)은 내부 관리용 명칭으로 유지한다.
ALTER TABLE public.customer_master
  ADD COLUMN IF NOT EXISTS company_name text;

COMMENT ON COLUMN public.customer_master.company_name IS
  '업체명(상호명): 사업자등록증 또는 고객 공식 상호. customer_master.name은 내부 거래처명으로 유지';

NOTIFY pgrst, 'reload schema';
