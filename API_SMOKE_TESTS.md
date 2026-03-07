# API Smoke Tests

## 목적
API smoke test는 배포 직전 또는 CI에서 **핵심 API가 최소 수준으로 살아있는지** 빠르게 확인하는 용도입니다.

전체 API 테스트와의 차이:
- `smoke`: 읽기 전용 중심, 짧은 실행 시간, 배포 전 기본 생존 확인
- `test:api`: 기존 전체 API 스위트, 더 넓은 범위 검증, 일부 환경/데이터 의존성 큼

현재 smoke test의 목표는 다음입니다.
- 앱 서버가 정상 기동되는지
- Supabase 연결이 가능한지
- 입고 조회 API의 기본 응답 구조가 유지되는지
- 관리자 감사 로그 조회 API가 동작하는지
- `confirm_inbound_receipt` RPC와 `inventory_ledger` 조회가 가능한지

## 실행 명령

로컬:

```bash
npm run test:api:smoke -- --reporter=line
```

전체 API 테스트:

```bash
npm run test:api
```

CI 실행 흐름:
1. `npm ci`
2. `lint`
3. `typecheck`
4. `build`
5. 앱 기동
6. `/api/health` 준비 확인
7. `mkdir -p test-results/api-smoke && PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/api-smoke/api-smoke-results.json npm run test:api:smoke`
8. `scripts/check-api-smoke-results.mjs`로 결과 검증

## 필요한 환경변수

### 필수
- `CI_SMOKE_BYPASS_TOKEN`
  - `/api/health` smoke를 middleware bypass 헤더와 함께 실행할 때 사용
- `NEXT_PUBLIC_SUPABASE_URL`
  - Supabase 연결 및 인증 토큰 발급에 사용
- `SUPABASE_SERVICE_ROLE_KEY`
  - read-only 연결성 검증, RPC 존재 확인, ledger 조회에 사용

### 선택
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - 관리자 로그인 기반 API 검증에 필요
- `E2E_ADMIN_EMAIL`
  - 관리자 세션 로그인에 필요
- `E2E_ADMIN_PASSWORD`
  - 관리자 세션 로그인에 필요
- `E2E_READONLY_RECEIPT_ID`
  - 입고 조회 검증용 receipt ID 고정값. 없으면 DB에서 1건 조회 시도
- `E2E_BASE_URL`
  - 기본값은 `http://localhost:3000`

### 값이 없을 때 skip 되는 테스트
- `CI_SMOKE_BYPASS_TOKEN` 없음
  - `/api/health` smoke skip
- `NEXT_PUBLIC_SUPABASE_URL` 또는 `SUPABASE_SERVICE_ROLE_KEY` 없음
  - Supabase 연결
  - `confirm_inbound_receipt` RPC
  - `inventory_ledger` 조회
  - 입고 조회용 receipt 탐색
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` 없음
  - `/api/inbound/[id]` 로그인 기반 검증
  - `/api/admin/audit-logs` 로그인 기반 검증

## 테스트 파일 설명

### `tests/api/health.spec.ts`
- `/api/health` 응답 확인
- Supabase 읽기 연결 확인
- `GET /api/inbound/[id]` 기본 구조 확인
- `GET /api/admin/audit-logs` 관리자 조회 확인

### `tests/api/inbound-confirm.spec.ts`
- `confirm_inbound_receipt` RPC 존재/호출 가능 여부 확인
- `inventory_ledger` 읽기 조회 가능 여부 확인

## 현재 한계
- read-only 원칙 때문에 **실제 비즈니스 성공 경로**까지 검증하지는 않습니다
- `confirm_inbound_receipt`는 더미 UUID 호출로 존재/권한/연결성만 확인합니다
- secrets 구성 수준에 따라 검증력이 달라집니다
- 관리자 로그인 기반 테스트는 로컬 서버와 인증 환경이 정상이어야 실행됩니다

## 운영 권장사항

### CI secrets 권장 구성
- `CI_SMOKE_BYPASS_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_READONLY_RECEIPT_ID` (가능하면 권장)

### 로컬에서 의미 있게 돌리는 방법
1. 앱 서버 실행
2. `.env.local` 또는 환경변수에 위 값 설정
3. `npm run test:api:smoke -- --reporter=line` 실행

### 언제 `test:api`를 써야 하는가
- smoke가 아니라 회귀 범위를 넓게 보고 싶을 때
- 주문 import, 보안 하드닝, 기존 API 회귀까지 함께 확인할 때
- 테스트 데이터 및 인증 환경이 충분히 준비된 상태일 때

## CI 판정 기준
- smoke test 수집 결과가 0건이면 실패
- 모든 smoke가 skipped면 실패
- `/api/health` smoke가 skipped면 실패
- 일부 secrets 기반 테스트가 skip 되어도 `/api/health`가 실행되고 다른 smoke가 통과하면 허용

즉, `/api/health` 1개만 성공하고 나머지가 skip인 경우:
- 현재 기준에서는 **허용**
- 다만 실질 검증력은 낮으므로 CI secrets를 보강하는 것이 권장됩니다
