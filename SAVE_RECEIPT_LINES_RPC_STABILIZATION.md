# Save Receipt Lines RPC Stabilization

## 개요
- `saveReceiptLinesService()`의 기존 JS 반복 저장 로직을 DB RPC 기반으로 승격했다.
- 목표는 `inbound_receipt_lines` 저장과 `inbound_inspections` 이력 적재를 하나의 트랜잭션으로 묶어 중간 실패 시 데이터 불일치를 제거하는 것이다.
- 단일 품목 / 다품목 검수 UI와 API 계약은 최대한 유지했다.

## 기존 saveReceiptLinesService() 분석

### 1. inbound_receipt_lines 업데이트 방식
- 기존 서비스는 JS에서 기존 라인을 조회한 뒤,
  - stale line 계산
  - duplicate line 정리
  - 각 라인별 `update` 또는 `insert`
  - receipt 상태 `COUNTING` 또는 `updated_at` 갱신
  를 순차 실행했다.

### 2. stale line 정리 로직
- 입력된 `plan_line_id` 집합을 기준으로 현재 receipt에 존재하지만 payload에 없는 라인을 stale로 보고 삭제했다.
- 같은 `plan_line_id`가 여러 건 있으면 최신 1건만 남기고 중복을 삭제했다.

### 3. inbound_inspections insert 로직
- 기존에는 `app/api/inbound/[id]/inspect/route.ts`에서 service 호출 후 별도로 `inbound_inspections`를 insert 했다.
- 따라서 line 저장 성공 후 inspection 이력 insert 실패 시 불일치가 가능했다.

### 4. 단일 품목 / lines[] 처리 분기
- 단일 품목은 route에서 legacy body를 `normalizedLines` 1건으로 변환했다.
- 다품목은 `lines[]`를 route에서 정규화한 뒤 service에 넘겼다.
- 그러나 실제 DB 반영은 service와 route로 나뉘어 있어 원자성이 없었다.

## 신규 RPC

### 함수명
- `public.save_receipt_lines_batch`

### 입력 구조
- `p_tenant_id uuid`
- `p_receipt_id uuid`
- `p_actor_id uuid`
- `p_lines jsonb`
- `p_inspections jsonb default '[]'::jsonb`
- `p_require_full_line_set boolean default false`

### p_lines 예시
```json
[
  {
    "receipt_line_id": "uuid",
    "plan_line_id": "uuid",
    "product_id": "uuid",
    "expected_qty": 10,
    "received_qty": 8,
    "damaged_qty": 2,
    "missing_qty": 0,
    "other_qty": 0,
    "notes": "박스 찌그러짐",
    "location_id": null
  }
]
```

### p_inspections 예시
```json
[
  {
    "product_id": "uuid",
    "expected_qty": 10,
    "received_qty": 8,
    "rejected_qty": 2,
    "condition": "DAMAGED",
    "note": "박스 찌그러짐",
    "photos": [],
    "inspected_at": "2026-03-07T10:00:00.000Z"
  }
]
```

### 반환 구조
```json
{
  "success": true,
  "has_changes": true,
  "cleanup_count": 0,
  "inspection_count": 2,
  "receipt_status": "COUNTING"
}
```

## RPC 내부 처리

1. receipt 존재 여부 검증
2. `tenant_id`와 `receipt.org_id` 일치 검증
3. 확정/취소 상태 수정 차단
4. lines payload 유효성 검증
5. 중복 `receipt_line_id`, `plan_line_id` 차단
6. stale / duplicate line 정리
7. `inbound_receipt_lines` 일괄 update / insert
8. `inbound_inspections` 일괄 insert
9. receipt 상태 `COUNTING` 유지 규칙 적용
10. 전체를 하나의 함수 실행 단위로 원자 처리

## 서비스 레이어 변경

### 변경 파일
- `services/inbound/inboundService.ts`
- `app/api/inbound/[id]/inspect/route.ts`
- `supabase/migrations/20260307170000_save_receipt_lines_batch_rpc.sql`

### 내부 처리 방식 변화
- 이전: JS 반복 update/insert + route 별도 inspection insert
- 이후: service에서 RPC 1회 호출 + route는 inspection payload만 전달

### 시그니처 호환
- 기존:
```ts
saveReceiptLinesService(db, userId, receiptId, lines)
```

- 현재:
```ts
saveReceiptLinesService(db, userId, receiptId, lines, {
  inspectionEntries?: [...],
  requireFullLineSet?: boolean,
})
```

- 5번째 인자는 optional이라 기존 호출부는 그대로 동작한다.

## 해소된 리스크

1. line 저장 성공 후 inspection 이력 실패
2. stale line 삭제 후 중간 insert 실패
3. 다품목 저장 중 일부 라인만 반영
4. tenant mismatch 상태에서 잘못된 receipt 수정

## 기존 기능 영향 여부

| 항목 | 영향 |
| --- | --- |
| 단일 품목 검수 | 유지 |
| 다품목 검수 | 유지 |
| 기존 `saveReceiptLines(receiptId, lines)` 액션 | 유지 |
| 기존 API 응답 shape | 유지 |
| 확정 로직 (`confirmReceiptService`) | 유지 |

## 롤백 포인트

### 코드 롤백
- `services/inbound/inboundService.ts`에서 RPC 호출을 제거하고 이전 JS 반복 처리 버전으로 복귀
- `app/api/inbound/[id]/inspect/route.ts`에서 service options 제거 및 직접 inspection insert 복구

### DB 롤백
- 신규 함수 제거:
```sql
DROP FUNCTION IF EXISTS public.save_receipt_lines_batch(uuid, uuid, uuid, jsonb, jsonb, boolean);
```

## 남아 있는 리스크

1. route 레벨의 `INSPECTING / DISCREPANCY` 상태 전환은 아직 RPC 밖에 있다.
2. 검수 저장 + receipt 상태 전이 + 확정까지 한 번에 묶는 최종 RPC는 아직 아니다.
3. `inbound_inspections`는 append-only 이력이므로 반복 저장 시 이력 누적은 계속 발생한다.

## 다음 권장 작업

1. 검수 route 전체를 `save_inbound_inspection_and_transition` RPC로 일원화
2. `confirmReceiptService()`와 저장 서비스의 경계 정리
3. 다품목 검수 API 테스트 추가
