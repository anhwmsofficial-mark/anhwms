CREATE TABLE IF NOT EXISTS public.common_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_code text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(group_code, code)
);

COMMENT ON TABLE public.common_codes IS '공통 코드 관리 (드롭다운 옵션 등)';

-- RLS
ALTER TABLE public.common_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.common_codes;
DROP POLICY IF EXISTS "Enable write access for admins only" ON public.common_codes;

CREATE POLICY "Enable read access for all users" ON public.common_codes
    FOR SELECT USING (true);

CREATE POLICY "Enable write access for admins only" ON public.common_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- 초기 데이터 시딩 (입고 상태)
INSERT INTO public.common_codes (group_code, code, label, sort_order) VALUES
('INBOUND_STATUS', 'SUBMITTED', '입고 예정', 10),
('INBOUND_STATUS', 'ARRIVED', '현장 도착', 20),
('INBOUND_STATUS', 'PHOTO_REQUIRED', '확인중', 30),
('INBOUND_STATUS', 'COUNTING', '수량 확인중', 40),
('INBOUND_STATUS', 'INSPECTING', '검수중', 50),
('INBOUND_STATUS', 'DISCREPANCY', '이슈 발생', 60),
('INBOUND_STATUS', 'CONFIRMED', '완료됨', 70),
('INBOUND_STATUS', 'PUTAWAY_READY', '적치 대기', 80)
ON CONFLICT (group_code, code)
DO UPDATE SET
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();
