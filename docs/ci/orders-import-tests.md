# orders/import 테스트 실행·운영 가이드

## 개요

`tests/api/orders-import-transaction.spec.ts`는 orders/import API의 트랜잭션 경계와 정합성을 검증한다.
이 문서는 테스트 실행 방식과 CI 반영 기준을 정리한다.

---

## 실행·운영 요약

| 항목 | 내용 |
|------|------|
| **DB 직접 검증** | `SUPABASE_SERVICE_ROLE_KEY`가 있을 때만 `ordersDbHelper`로 order/receiver row 개수 검증 |
| **응답만 검증** | 위 키가 없으면 API 응답(successCount, failedCount, failed[])만 검증, 테스트는 통과 |
| **상시 CI** | `E2E_RUN_IMPORT_TRANSACTION=1` 설정 시 검증 실패·중복·부분 성공 케이스 실행 |
| **플래그 CI** | `E2E_RUN_IMPORT_EXTERNAL_SYNC_FAILURE=1` 설정 시 외부 연동 실패 케이스 실행 |
| **external sync failure** | 현재 선택 실행. live CJ 환경 또는 실패 유도 환경 필요. 상시 CI에는 미포함 |

---

## 상시 실행 케이스 (E2E_RUN_IMPORT_TRANSACTION=1)

다음 케이스는 `E2E_RUN_IMPORT_TRANSACTION=1` 설정 시 함께 실행된다.

| 케이스 | 설명 | DB 직접 검증 |
|--------|------|--------------|
| 검증 실패 후 재시도 성공 | validation 실패 시 orderNo 미점유 → 재시도 성공 | orders=0, receivers=0 (실패 후) / 1,1 (재시도 후) |
| 동일 파일 중복 | 첫 행만 커밋, 두 번째 행 DUPLICATE → 재업로드 시 duplicate | orders=1, receivers=1 |
| 부분 성공 집계 형식 | successCount + failedCount = 입력 행 수, failed[] 형식 일관성 | - |

**필수 환경 변수**

- `E2E_EMAIL`, `E2E_PASSWORD` (인증)
- `NEXT_PUBLIC_SUPABASE_URL` 또는 `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (DB 직접 검증 시)

**DB 직접 검증**

- `SUPABASE_SERVICE_ROLE_KEY`가 있으면 `tests/helpers/ordersDbHelper`로 order/receiver row 개수 검증
- 없으면 응답 기반 검증만 수행 (테스트는 통과)

---

## 플래그 기반 실행 케이스 (E2E_RUN_IMPORT_EXTERNAL_SYNC_FAILURE=1)

| 케이스 | 설명 | 비고 |
|--------|------|------|
| 외부 연동 실패 | CJ 연동 실패 시 주문 커밋 유지, 재업로드 시 duplicate | live CJ 환경 또는 실패 유도 환경 필요 |

**주의**

- CJ 브리지가 실제로 실패하는 환경이 필요
- 상시 CI에는 넣지 말 것 (환경 의존성 큼)

---

## 향후 mock/stub 도입 후 상시 후보

| 케이스 | 현재 | mock 도입 후 |
|--------|------|--------------|
| 외부 연동 실패 | 플래그 기반 | `cjRegBookCall` stub으로 상시 실행 가능 |

**도입 방향**

- `cjRegBookCall`을 DI 또는 test-only fake로 교체
- 또는 test 전용 mock CJ bridge endpoint 사용

---

## CI 설정 예시

```yaml
# 상시 실행 (preview/test DB + 인증 계정)
env:
  E2E_RUN_IMPORT_TRANSACTION: "1"
  E2E_EMAIL: ${{ secrets.E2E_EMAIL }}
  E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}

# 외부 연동 실패 케이스는 별도 스케줄/수동 실행
# env:
#   E2E_RUN_IMPORT_EXTERNAL_SYNC_FAILURE: "1"
```

---

## 실행 방법

```bash
# 상시 케이스만
E2E_RUN_IMPORT_TRANSACTION=1 npm run test:api -- tests/api/orders-import-transaction.spec.ts

# 외부 연동 실패 포함
E2E_RUN_IMPORT_TRANSACTION=1 E2E_RUN_IMPORT_EXTERNAL_SYNC_FAILURE=1 npm run test:api -- tests/api/orders-import-transaction.spec.ts
```

---

## 남은 후속 과제

- **recipient rollback**: test seam 도입 후 검증 추가
- **mock/stub**: `cjRegBookCall` fake로 external sync 실패 상시 CI 후보화
- **idempotency**: idempotency key 도입 시 별도 테스트 추가
