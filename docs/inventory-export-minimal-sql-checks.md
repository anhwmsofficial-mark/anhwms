# 재고 엑셀 시스템 최소 점검 SQL

## 용도
- Supabase 적용 전후에 빠르게 상태를 확인하는 최소 쿼리만 모아둔 문서입니다.
- 운영 점검 시에는 아래 순서대로 복붙해서 확인하면 됩니다.

## 1. 적용 전 movement type 점검

```sql
select movement_type, count(*) as cnt
from public.inventory_ledger
group by movement_type
order by cnt desc, movement_type asc;
```

확인 포인트:
- 예상하지 못한 `movement_type` 값이 있는지 확인

## 2. 조직 정보 누락 확인

```sql
select 'customer_master' as source, count(*) as missing_org_count
from public.customer_master
where org_id is null
union all
select 'user_profiles' as source, count(*) as missing_org_count
from public.user_profiles
where org_id is null;
```

확인 포인트:
- 가능하면 둘 다 `0`

## 3. `inventory_snapshot` 확장 컬럼 확인

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'inventory_snapshot'
  and column_name in ('opening_stock', 'total_in', 'total_out', 'closing_stock')
order by column_name;
```

확인 포인트:
- `opening_stock`, `total_in`, `total_out` 존재 여부

## 4. 기존 스냅샷 백필 확인

```sql
select
  count(*) as total_rows,
  count(*) filter (where opening_stock is null) as opening_stock_null_rows,
  count(*) filter (where total_in is null) as total_in_null_rows,
  count(*) filter (where total_out is null) as total_out_null_rows
from public.inventory_snapshot;
```

확인 포인트:
- null row가 모두 `0`

## 5. 템플릿 테이블 생성 확인

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('export_templates', 'export_template_columns')
order by table_name;
```

## 6. 기본 템플릿 생성 확인

```sql
select tenant_id, code, name, is_active, created_at
from public.export_templates
where code = 'inventory-default'
order by created_at desc;
```

확인 포인트:
- 조직별 `inventory-default` 존재 여부

## 7. 기본 템플릿 컬럼 수 확인

```sql
select et.code, count(*) as column_count
from public.export_template_columns etc
join public.export_templates et
  on et.id = etc.template_id
where et.code = 'inventory-default'
group by et.code;
```

확인 포인트:
- 기본 컬럼 + 트랜잭션 컬럼이 들어가 있으므로 10개 이상은 나와야 정상

## 8. 기본 템플릿 컬럼 순서 확인

```sql
select
  et.code,
  etc.sort_order,
  etc.source,
  etc.transaction_type,
  etc.header_name
from public.export_template_columns etc
join public.export_templates et
  on et.id = etc.template_id
where et.code = 'inventory-default'
order by et.tenant_id, etc.sort_order asc;
```

확인 포인트:
- `관리명 -> 전일재고 -> 트랜잭션 컬럼들 -> 총합계 -> 마감재고 -> 비고`

## 9. RLS 정책 확인

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('export_templates', 'export_template_columns')
order by tablename, policyname;
```

## 10. 중복 정렬 순서 확인

```sql
select template_id, sort_order, count(*) as cnt
from public.export_template_columns
group by template_id, sort_order
having count(*) > 1
order by cnt desc, template_id, sort_order;
```

확인 포인트:
- 결과가 없어야 정상

## 11. 재고 화면 데이터 존재 여부 확인

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

## 12. 최종 한 줄 점검

```sql
select
  (select count(*) from public.export_templates) as template_count,
  (select count(*) from public.export_template_columns) as template_column_count,
  (select count(*) from public.inventory_snapshot where opening_stock is null or total_in is null or total_out is null) as invalid_snapshot_rows;
```

기대 결과:
- `template_count > 0`
- `template_column_count > 0`
- `invalid_snapshot_rows = 0`
