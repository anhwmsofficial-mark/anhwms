# Test Execution Guide

이 문서는 조건부 Playwright 검증을 실행할 때 필요한 최소 환경 변수를 정리합니다.

## 공통

- 기본 base URL: `E2E_BASE_URL=http://localhost:3000`
- 인증 계정:
  - 우선 사용: `E2E_EMAIL`, `E2E_PASSWORD`
  - 대체 사용: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`

## 보안 하드닝 검증

파일: `tests/api/security-hardening.spec.ts`

기본 차단 케이스는 별도 env 없이 실행됩니다.

```powershell
npx playwright test tests/api/security-hardening.spec.ts
```

### 1. 공유 비밀번호 brute-force / backoff 검증

필수 env:
- `E2E_RUN_SHARE_BRUTE_FORCE=1`
- `E2E_SHARE_INVENTORY_SLUG` 또는 `E2E_SHARE_INBOUND_SLUG`

예시:

```powershell
$env:E2E_RUN_SHARE_BRUTE_FORCE="1"
$env:E2E_SHARE_INBOUND_SLUG="your-share-slug"
npx playwright test tests/api/security-hardening.spec.ts --grep "brute-force|rate-limit"
```

### 2. 타 조직 ownership 차단 검증

필수 env:
- `E2E_RUN_FOREIGN_OWNERSHIP=1`
- `E2E_FOREIGN_RECEIPT_ID=<현재 로그인 조직이 소유하지 않은 receipt id>`
- 인증 계정 env

예시:

```powershell
$env:E2E_RUN_FOREIGN_OWNERSHIP="1"
$env:E2E_EMAIL="admin@example.com"
$env:E2E_PASSWORD="password"
$env:E2E_FOREIGN_RECEIPT_ID="00000000-0000-0000-0000-000000000000"
npx playwright test tests/api/security-hardening.spec.ts --grep "타 조직"
```

### 3. 업로드 파일 검증

필수 env:
- `E2E_RUN_UPLOAD_VALIDATION=1`
- 인증 계정 env

이 테스트는 서버가 `.exe` 업로드를 `400/401/403`으로 차단하는지 확인합니다.

예시:

```powershell
$env:E2E_RUN_UPLOAD_VALIDATION="1"
$env:E2E_EMAIL="admin@example.com"
$env:E2E_PASSWORD="password"
npx playwright test tests/api/security-hardening.spec.ts --grep "업로드 파일"
```

## 운영 전 권장 순서

1. `npm run build`
2. `npx playwright test tests/api/security-hardening.spec.ts`
3. 필요 시 위 조건부 env를 켜고 share/ownership/upload 검증을 추가 실행

## 입고 검수 API 검증

파일:
- `tests/api/inbound-inspect.spec.ts`
- `tests/helpers/inboundInspectHelper.ts`

### 실행 방식

- 읽기 전용 조회/차단 검증:

```powershell
npx playwright test tests/api/inbound-inspect.spec.ts
```

- 쓰기 포함 전체 검증:

```powershell
$env:E2E_RUN_INBOUND_INSPECT_WRITE="1"
npx playwright test tests/api/inbound-inspect.spec.ts
```

### 필수 env

- 조회/로그인 기반 검증:
  - `E2E_ADMIN_EMAIL` 또는 `E2E_EMAIL`
  - `E2E_ADMIN_PASSWORD` 또는 `E2E_PASSWORD`
- DB fixture 생성/검증:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- 선택:
  - `E2E_READONLY_RECEIPT_ID`
  - `E2E_RUN_INBOUND_INSPECT_WRITE=1`
  - `E2E_RUN_INBOUND_TENANT_MISMATCH=1`
  - `E2E_FOREIGN_RECEIPT_ID`

### 커버 범위

- 단일 품목 조회
- 다품목 조회
- 단일 품목 저장
- 단일 품목 finalize 성공
- 다품목 lines 배열 저장
- 다품목 일부 라인 전송 차단
- `CONFIRMED` / `PUTAWAY_READY` / `CANCELLED` 수정 차단
- 필수 사진 누락 시 finalize rollback 확인
- inspection history 적재 확인
- audit log 적재 확인

### 현재 자동화로 커버하지 않는 영역

- foreign tenant 차단은 `E2E_FOREIGN_RECEIPT_ID`가 있을 때만 선택 실행
- 실제 모바일 UI 입력 흐름은 이 파일이 아니라 e2e UI 시나리오에서 별도 검증 필요
- finalize 후 inventory ledger 상세 값 비교는 현재 건수 중심 검증
