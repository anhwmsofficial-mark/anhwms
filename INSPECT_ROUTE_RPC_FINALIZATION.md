# Inspect Route RPC Finalization

## 목적

`app/api/inbound/[id]/inspect/route.ts`에 남아 있던 상태 전이 로직을 DB RPC로 이동해, 검수 저장과 상태 변경이 하나의 트랜잭션으로 완료되도록 정리했다.

## 이번 변경

- 신규 RPC `public.save_inbound_inspection_and_transition`
- 신규 서비스 래퍼 `saveInboundInspectionAndTransitionService()`
- inspect route에서 제거된 상태 전이:
  - 저장 후 `INSPECTING` / `DISCREPANCY` 직접 분기
  - `inbound_receipts.status` 직접 `update`
  - finalize 시 저장 후 별도 `confirmReceiptService()` 호출

## RPC 처리 범위

1. receipt 존재 / tenant 일치 / 수정 가능 상태 검증
2. `save_receipt_lines_batch` 호출
3. `inbound_receipt_lines` 저장
4. `inbound_inspections` 이력 적재
5. 상태 전이 처리
   - 일반 저장: `INSPECTING` 또는 `DISCREPANCY`
   - finalize: 사진 검증 후 `DISCREPANCY` 또는 `PUTAWAY_READY`
6. 전체 rollback 보장

## confirmReceiptService 경계

- `confirmReceiptService()`는 기존 확정 전용 경로 호환을 위해 유지
- inspect route에서는 더 이상 직접 사용하지 않음
- inspect route의 finalize는 신규 RPC 내부에서 `confirm_inbound_receipt`를 호출해 처리

## 해소된 리스크

- 라인 저장 성공 후 receipt 상태 업데이트 실패
- finalize 저장 성공 후 confirm 단계 실패
- 저장/이력 적재와 상태 전이 사이의 partial failure

## 남은 리스크

- 이벤트 로그 / 감사 로그는 비핵심 부가 처리로 서비스 레이어에 남아 있어, 로그 실패가 비즈니스 트랜잭션을 되돌리지는 않음
- `confirm_inbound_receipt` 자체는 기존 구현을 유지하므로, 이후 단계에서 inventory ledger 중복 방지 키 강화 여부를 추가 검토할 수 있음

## 롤백 포인트

1. 신규 마이그레이션 롤백 또는 함수 제거
2. inspect route를 기존 `saveReceiptLinesService() + confirmReceiptService()` 흐름으로 복귀
3. 서비스 래퍼 `saveInboundInspectionAndTransitionService()` 호출 제거
