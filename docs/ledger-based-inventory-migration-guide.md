# Ledger 기반 재고 구조 가이드

## 목표
- 재고를 컬럼 상태값이 아닌 원장(`inventory_ledger`) 기록으로 관리
- 화면은 천단위 포맷, 저장은 숫자형(콤마 금지) 원칙 유지
- 멀티테넌트 확장을 위해 `tenant_id`를 원장/스냅샷에 적용

## 핵심 테이블
- `inventory_ledger`: 재고 이동 원장
- `inventory_snapshot`: 일마감 캐시(조회 성능용)
- `v_inventory_stock_current`: 원장 누적합 기반 현재고 뷰

## movement_type 표준
| 엑셀 컬럼 | movement_type | direction |
|---|---|---|
| 입고 | INBOUND | IN |
| 폐기(-) | DISPOSAL | OUT |
| 파손 | DAMAGE | OUT |
| 반품(B2C) | RETURN_B2C | IN |
| 택배 | OUTBOUND | OUT |
| 재고조정(+) | ADJUSTMENT_PLUS | IN |
| 재고조정(-) | ADJUSTMENT_MINUS | OUT |
| 번들해체(+) | BUNDLE_BREAK_IN | IN |
| 번들해체(-) | BUNDLE_BREAK_OUT | OUT |
| 수출픽업(-) | EXPORT_PICKUP | OUT |
| 출고취소 | OUTBOUND_CANCEL | IN |

추가:
- `INVENTORY_INIT`: 초기 이관/초기잔고 주입용
- `TRANSFER`: 창고/로케이션 이동용(추후 IN/OUT 쌍 분리 가능)

## 재고 계산 공식
```sql
SELECT
  tenant_id,
  product_id,
  SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) AS current_stock
FROM inventory_ledger
GROUP BY tenant_id, product_id;
```

## 엑셀 → WMS 이관 전략
1. 초기 재고를 `INVENTORY_INIT`으로 1회 적재
2. 엑셀 컬럼별로 movement_type 매핑 후 적재
3. `idempotency_key`를 함께 저장해 중복 적재 방지
4. SKU별 누적합 결과를 엑셀 마감 재고와 대사

### staging 기반 권장 흐름
- `migrations/122_inventory_ledger_excel_staging_template.sql` 적용
- `inventory_ledger_staging`에 엑셀 원본 업로드
- `v_inventory_ledger_staging_movements`로 표준 movement row 확인
- 주석 처리된 `INSERT ... SELECT` 예시로 원장 적재

## 입력/저장 규칙
- 화면 입력:
  - 수량/물량: 정수
  - 금액: 소수 2자리 허용
- API/DB 저장:
  - 콤마 제거 후 숫자 파싱
  - DB에는 숫자형으로만 저장

## 운영 권장
- 원장(`inventory_ledger`)은 진실 원본
- 대시보드/집계 조회는 `inventory_snapshot` 우선 사용
- 정합성 검증은 주기적으로 원장 누적합과 스냅샷을 비교

## API 확장
- 신규 엔드포인트: `POST /api/admin/inventory/movements`
  - 입력: `tenantId, warehouseId, productId, movementType, quantity, ...`
  - 검증: `lib/schemas/inventoryLedger.ts`
  - 동작: ledger 기록 + inventory_quantities upsert + products.quantity 동기화
- 신규 엔드포인트: `POST /api/admin/inventory/import-staging`
  - 목적: `v_inventory_ledger_staging_movements` 데이터를 ledger로 적재
  - 요청 예시:
    - `{ "tenantId": "<uuid>", "sourceFileName": "2026-02-stock.xlsx", "dryRun": true, "limit": 1000 }`
  - 동작: `idempotency_key` 기준 중복 제거하며 upsert
- 신규 엔드포인트: `POST /api/admin/inventory/import-staging/upload-file`
  - 목적: 엑셀 파일을 서버에서 직접 파싱하여 `inventory_ledger_staging` 적재
  - 방식: multipart/form-data (`tenantId`, `warehouseId`, `sourceFileName`, `file`)
  - 프리뷰: `dryRun=true`를 함께 보내면 실제 insert 없이 파싱/매핑 결과 반환
  - 수동매핑: `resolveMap`(JSON, `{"SKU":"productId"}`) 전달 시 미매칭 SKU 강제 매핑 가능
- 신규 엔드포인트: `GET /api/admin/inventory/import-staging/runs`
  - 목적: import 실행 이력 조회
- 신규 엔드포인트: `GET /api/admin/inventory/import-staging/template`
  - 목적: staging 업로드용 CSV 템플릿 다운로드
