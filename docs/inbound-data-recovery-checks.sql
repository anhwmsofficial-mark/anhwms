-- 입고현황 데이터 소실 여부 점검 및 복구 보조 SQL
-- Supabase SQL Editor에서 위에서 아래 순서로 실행하세요.

-- 1) 2026-04-16 이후 입고 예정/인수 데이터 존재 여부
select 'inbound_plans_after_2026_04_16' as metric, count(*) as row_count
from public.inbound_plans
where planned_date > date '2026-04-16'
union all
select 'inbound_receipts_created_after_2026_04_16' as metric, count(*) as row_count
from public.inbound_receipts
where created_at::date > date '2026-04-16';

-- 2) 2026-04-01 이후 날짜별 입고 예정 분포
select
  planned_date,
  count(*) as plan_count,
  min(created_at) as first_created_at,
  max(created_at) as last_created_at
from public.inbound_plans
where planned_date >= date '2026-04-01'
group by planned_date
order by planned_date desc;

-- 3) 화면 목록 기준 상세 확인 (최신 등록순)
select
  p.id as plan_id,
  p.plan_no,
  p.planned_date,
  p.created_at as plan_created_at,
  p.status as plan_status,
  cm.name as client_name,
  r.id as receipt_id,
  r.receipt_no,
  r.status as receipt_status,
  r.created_at as receipt_created_at
from public.inbound_plans p
left join public.customer_master cm on cm.id = p.client_id
left join public.inbound_receipts r on r.plan_id = p.id
where p.planned_date >= date '2026-04-01'
order by p.created_at desc
limit 200;

-- 4) 입고 예정은 있는데 인수 데이터가 없는 건 확인
select
  p.id as plan_id,
  p.plan_no,
  p.planned_date,
  p.created_at,
  p.status
from public.inbound_plans p
left join public.inbound_receipts r on r.plan_id = p.id
where r.id is null
order by p.created_at desc
limit 200;

-- 5) 실수로 plan_id 연결이 빠진 인수 데이터 후보 확인
-- 같은 org/client/warehouse + 비슷한 생성일의 receipt가 있는지 확인용입니다.
select
  r.id as receipt_id,
  r.receipt_no,
  r.org_id,
  r.client_id,
  r.warehouse_id,
  r.plan_id,
  r.status,
  r.created_at
from public.inbound_receipts r
where r.plan_id is null
  and r.created_at::date >= date '2026-04-01'
order by r.created_at desc
limit 200;

-- 6) 복구 예시: plan_id가 빠진 receipt를 특정 plan에 연결해야 할 때만 사용
-- 실제 plan_id/receipt_id를 확인한 뒤 주석 해제해서 1건씩 실행하세요.
-- update public.inbound_receipts
-- set plan_id = '<PLAN_ID>'::uuid,
--     updated_at = now()
-- where id = '<RECEIPT_ID>'::uuid
--   and plan_id is null;
