-- inbound/new E2E 정리 스크립트
-- 대상: notes 가 'E2E-INBOUND-NEW-%' 인 입고 예정 데이터
-- 주의: 운영 데이터에서 실행 전 반드시 Preview 쿼리로 확인하세요.

-- 1) Preview: 삭제 대상 입고 예정 목록 확인
select
  p.id,
  p.plan_no,
  p.status,
  p.planned_date,
  p.notes,
  p.created_at
from public.inbound_plans p
where p.notes like 'E2E-INBOUND-NEW-%'
order by p.created_at desc;

-- 2) Preview: 라인 개수 확인
select
  p.id as plan_id,
  p.plan_no,
  count(l.id) as line_count
from public.inbound_plans p
left join public.inbound_plan_lines l on l.plan_id = p.id
where p.notes like 'E2E-INBOUND-NEW-%'
group by p.id, p.plan_no
order by p.plan_no;

-- 3) Delete: 입고 예정 삭제
-- inbound_plan_lines 는 FK ON DELETE CASCADE 로 함께 정리됨
begin;

delete from public.inbound_plans p
where p.notes like 'E2E-INBOUND-NEW-%';

commit;

-- 4) Verify: 잔여 데이터 확인
select count(*) as remaining_count
from public.inbound_plans p
where p.notes like 'E2E-INBOUND-NEW-%';
