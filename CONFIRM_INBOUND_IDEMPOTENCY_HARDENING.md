# Confirm Inbound Idempotency Hardening

## 목적

`confirm_inbound_receipt` RPC가 네트워크 재시도, 중복 클릭, 재호출 상황에서도 `inventory_ledger`를 중복 적재하지 않도록 DB 레벨 방어를 강화했다.

## 기존 구조

- receipt row는 `FOR UPDATE`로 잠금
- `PUTAWAY_READY` / `CONFIRMED` 상태는 예외 처리
- 각 `inbound_receipt_lines`를 순회하며 `inventory_ledger` insert
- 이어서 `inventory_quantities` 증가

이 구조는 단일 트랜잭션이라는 점은 안전했지만, ledger insert 자체에 명시적인 idempotency key가 없어 재실행 안전성을 더 강화할 여지가 있었다.

## 이번 강화 내용

1. `inventory_ledger.idempotency_key` 사용
   - 형식: `inbound-confirm:{receipt_id}:{receipt_line_id}`
   - 기존 고유 인덱스 `uq_inventory_ledger_tenant_idempotency` 활용

2. `ON CONFLICT DO NOTHING` 적용
   - 동일 receipt line에 대해 ledger가 이미 있으면 추가 insert를 생략

3. quantities 반영 조건 분리
   - ledger insert가 실제로 성공한 경우에만 `inventory_quantities`를 증가
   - 따라서 재시도 시 재고 수량도 중복 증가하지 않음

4. 이미 확정된 receipt는 no-op success
   - `PUTAWAY_READY` / `CONFIRMED` 상태면 예외 대신 성공 응답
   - 응답에 `already_confirmed: true` 포함

## DB 레벨 방어 방식

- 1차 방어: `inbound_receipts` row lock (`FOR UPDATE`)
- 2차 방어: `inventory_ledger(tenant_id, idempotency_key)` 고유 인덱스
- 3차 방어: ledger insert 성공 시에만 `inventory_quantities` update

## 기존 대비 변경점

- 기존: 중복 확정 시 예외
- 변경 후: 이미 확정 상태면 성공 no-op
- 기존: ledger insert 성공 여부와 무관하게 다음 로직 진행 구조
- 변경 후: 실제 ledger insert 성공 여부를 기준으로 quantities 반영

## 기존 기능 영향

- 정상 확정 흐름 유지
- inspect finalize 경로 유지
- 기존 action/API 응답 shape 유지
- 추가 메타 정보(`already_confirmed`)는 하위 호환으로만 사용

## 롤백 포인트

1. `supabase/migrations/20260307180000_harden_confirm_inbound_receipt_idempotency.sql` 롤백
2. `confirmReceiptService()`의 `alreadyConfirmed` 처리 제거
3. 기존 `confirm_inbound_receipt` 함수 정의로 복귀
