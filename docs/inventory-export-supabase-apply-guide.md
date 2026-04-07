# 재고 엑셀 시스템 Supabase 적용 가이드

## 목적
- 재고 엑셀 시스템 관련 DB 변경을 운영/스테이징 환경에 안전하게 적용합니다.
- 적용 직후 바로 검증할 수 있는 SQL 점검 쿼리를 제공합니다.

## 대상 마이그레이션
- `supabase/migrations/20260313103000_inventory_export_templates_and_snapshot_expansion.sql`

이 마이그레이션은 다음을 포함합니다.
- `inventory_snapshot` 확장
- `inventory_ledger` movement type 체크 제약 확장
- `export_templates`, `export_template_columns` 생성
- 조직별 기본 `inventory-default` 템플릿 시드

## 적용 방법 A. Supabase CLI 권장

### 1. 사전 점검
프로젝트 루트에서 실행:

```bash
npm run check:migrations
npm run check:migration-filenames
npx supabase migration list
```

확인 포인트:
- 로컬 마이그레이션 파일명 검사 통과
- 현재 원격 migration history가 정상인지 확인
- 예상하지 못한 pending/repair 상태가 없는지 확인

### 2. DB 백업
운영 환경에서는 반드시 DB 백업 또는 스냅샷을 먼저 생성합니다.

확인 예시:
- Supabase Dashboard에서 백업 상태 확인
- 또는 운영팀 표준 백업 절차 수행

### 3. 마이그레이션 적용

```bash
npx supabase db push
```

적용 후 다시 확인:

```bash
npx supabase migration list
```

기대 결과:
- `20260313103000_inventory_export_templates_and_snapshot_expansion.sql`가 적용된 상태로 표시

## 적용 방법 B. Supabase SQL Editor 수동 실행

CLI 대신 수동 적용할 경우 순서는 다음과 같습니다.

1. Supabase Dashboard 접속
2. 대상 프로젝트 선택
3. `SQL Editor` 이동
4. `New query` 클릭
5. `supabase/migrations/20260313103000_inventory_export_templates_and_snapshot_expansion.sql` 전체 내용 붙여넣기
6. `Run` 실행

주의:
- SQL Editor 수동 실행은 migration history 자동 관리가 불완전할 수 있으므로 가능하면 CLI 방식이 더 안전합니다.
- 이미 운영에서 CLI 기준으로 관리 중이면 `db push`를 우선 권장합니다.

## 적용 순서 상세

### 1단계. 적용 전 데이터 점검
아래 쿼리로 기존 상태를 확인합니다.

```sql
-- inventory_snapshot 현재 컬럼 상태
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'inventory_snapshot'
order by ordinal_position;
```

```sql
-- inventory_ledger movement_type 실제 사용값 확인
select movement_type, count(*) as cnt
from public.inventory_ledger
group by movement_type
order by cnt desc, movement_type asc;
```

```sql
-- 조직 정보 누락 여부
select 'customer_master' as source, count(*) as missing_org_count
from public.customer_master
where org_id is null
union all
select 'user_profiles' as source, count(*) as missing_org_count
from public.user_profiles
where org_id is null;
```

### 2단계. 마이그레이션 적용
- CLI: `npx supabase db push`
- 또는 SQL Editor 실행

### 3단계. 구조 확인
적용 후 아래 쿼리를 순서대로 확인합니다.

## 적용 후 점검 SQL 모음

### A. `inventory_snapshot` 확장 컬럼 확인

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'inventory_snapshot'
  and column_name in ('opening_stock', 'total_in', 'total_out', 'closing_stock')
order by column_name;
```

기대 결과:
- `opening_stock`, `total_in`, `total_out` 존재
- 모두 `NOT NULL`
- 기본값 `0`

### B. 기존 스냅샷 백필 확인

```sql
select
  count(*) as total_rows,
  count(*) filter (where opening_stock is null) as opening_stock_null_rows,
  count(*) filter (where total_in is null) as total_in_null_rows,
  count(*) filter (where total_out is null) as total_out_null_rows
from public.inventory_snapshot;
```

기대 결과:
- `*_null_rows` 모두 `0`

### C. 템플릿 테이블 생성 확인

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('export_templates', 'export_template_columns')
order by table_name;
```

### D. 기본 템플릿 생성 확인

```sql
select tenant_id, code, name, is_active, created_at
from public.export_templates
where code = 'inventory-default'
order by created_at desc;
```

기대 결과:
- 조직별 최소 1건 이상 존재

### E. 기본 템플릿 컬럼 확인

```sql
select
  et.code,
  etc.sort_order,
  etc.source,
  etc.transaction_type,
  etc.header_name,
  etc.is_visible
from public.export_template_columns etc
join public.export_templates et
  on et.id = etc.template_id
where et.code = 'inventory-default'
order by et.tenant_id, etc.sort_order asc;
```

확인 포인트:
- `관리명`, `전일재고`, 트랜잭션 컬럼들, `총합계`, `마감재고`, `비고` 순서 확인

### F. movement type 제약 반영 확인

```sql
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in (
  'inventory_ledger_movement_type_chk',
  'inventory_ledger_movement_direction_chk'
);
```

확인 포인트:
- 신규 타입 `DAMAGE`, `STOCK_ADJUSTMENT_IN`, `JET_RETURN`, `PARCEL_OUT` 등 포함 여부

### G. 특정 타입 insert 가능 여부 스모크 테스트
운영에서는 실제 insert 대신 스테이징 환경에서 먼저 확인하세요.

```sql
select
  case
    when 'DAMAGE' in (
      select unnest(regexp_matches(pg_get_constraintdef(oid), '''([A-Z_]+)''', 'g'))[1]
      from pg_constraint
      where conname = 'inventory_ledger_movement_type_chk'
    )
    then 'OK'
    else 'MISSING'
  end as damage_type_check;
```

### H. RLS 정책 생성 확인

```sql
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('export_templates', 'export_template_columns')
order by tablename, policyname;
```

### I. 중복 정렬 순서 검증

```sql
select template_id, sort_order, count(*) as cnt
from public.export_template_columns
group by template_id, sort_order
having count(*) > 1
order by cnt desc, template_id, sort_order;
```

기대 결과:
- 결과 없음

## 적용 후 UI 점검 순서

### 1. 템플릿 설정 페이지
- `/admin/inventory/export-templates` 접속
- `inventory-default` 템플릿 존재 여부 확인
- 트랜잭션 컬럼 체크 해제 후 저장
- 헤더명 변경 후 저장
- 새로고침 후 값 유지 확인

### 2. 재고 메인 페이지
- `/inventory` 접속
- 템플릿 선택
- 열 설정에서 일부 컬럼 숨김
- 재고 변동 입력 모달 열기
- 음수 재고 차감 시도 시 검증 메시지 확인

### 3. 엑셀 다운로드
- `/inventory`에서 `업체용 엑셀 다운로드` 실행
- 파일 다운로드 성공 여부 확인
- 숨긴 컬럼이 실제 엑셀에서도 빠졌는지 확인
- 템플릿에서 바꾼 헤더명이 그대로 반영됐는지 확인

## 장애 발생 시 빠른 확인 쿼리

### 템플릿이 안 보일 때

```sql
select tenant_id, code, name, is_active
from public.export_templates
order by created_at desc;
```

```sql
select id, org_id, role, can_access_admin, can_manage_inventory
from public.user_profiles
where id = auth.uid();
```

### 다운로드가 실패할 때

```sql
select et.id, et.code, et.name, count(etc.id) as column_count
from public.export_templates et
left join public.export_template_columns etc
  on etc.template_id = et.id
group by et.id, et.code, et.name
order by et.created_at desc;
```

### 재고 페이지가 비어 있을 때

```sql
select count(*) as product_count
from public.products
where customer_id is not null;
```

```sql
select tenant_id, count(*) as snapshot_count
from public.inventory_snapshot
group by tenant_id
order by snapshot_count desc;
```

```sql
select tenant_id, count(*) as ledger_count
from public.inventory_ledger
group by tenant_id
order by ledger_count desc;
```

## 권장 운영 순서 요약
1. 백업 생성
2. `npx supabase migration list`
3. `npx supabase db push`
4. 구조 확인 SQL 실행
5. 템플릿 기본 시드 확인
6. `/admin/inventory/export-templates` 저장 테스트
7. `/inventory` 재고 입력 테스트
8. 엑셀 다운로드 테스트
