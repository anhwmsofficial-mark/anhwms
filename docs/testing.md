# ANH WMS 테스트 가이드

현재 코드 기준 테스트 실행 방식과 CI 검증을 정리한다.

---

## 1. CI에서 항상 도는 검증

| 단계 | 명령 | 설명 |
|------|------|------|
| Lint | `npm run lint:ci` | 지정 경로 ESLint |
| Type Check | `npm run typecheck:ci` | `tsconfig.ci.json` 기반 |
| Build | `npm run build` | Next.js 프로덕션 빌드 |
| Smoke | `npm run smoke:ci` | `scripts/smoke-ci.mjs` |

**CI 설정**: `.github/workflows/app-ci.yml`

---

## 2. Smoke Test 개요

- **스크립트**: `scripts/smoke-ci.mjs`
- **대상**: `SMOKE_BASE_URL` (기본 `http://127.0.0.1:3000`)
- **검증 경로**:
  - `/api/health` (200, `ok: true`)
  - `/api/health/import-staging` (200)
  - `/api/admin/inbound-share` (400/401/403)
  - `/api/admin/inventory/volume/share` (400/401/403)
  - `/api/share/inbound` (400)
  - `/api/share/inventory` (400)

- **CI Smoke Bypass**: `CI_SMOKE_BYPASS_TOKEN` + `x-ci-smoke-bypass` 헤더로 인증 없이 위 경로 호출 가능 (CI 전용)

---

## 3. 플래그 기반 테스트

### orders/import 트랜잭션 테스트
- **파일**: `tests/api/orders-import-transaction.spec.ts`
- **플래그**: `E2E_RUN_IMPORT_TRANSACTION=1`
- **실행**:
  ```bash
  E2E_RUN_IMPORT_TRANSACTION=1 npm run test:api -- tests/api/orders-import-transaction.spec.ts
  ```
- **필수 env**: `E2E_EMAIL`, `E2E_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, (선택) `SUPABASE_SERVICE_ROLE_KEY`
- **상세**: `docs/ci/orders-import-tests.md`

### 외부 연동 실패 테스트
- **플래그**: `E2E_RUN_IMPORT_EXTERNAL_SYNC_FAILURE=1`
- **주의**: live CJ 환경 또는 실패 유도 환경 필요, 상시 CI에는 미포함

---

## 4. 테스트 명령 요약

```bash
# API 테스트 (Playwright)
npm run test:api

# E2E 전체
npm run test:e2e

# Smoke (로컬 서버 기동 후)
npm run smoke:ci
```

---

## 5. 테스트 환경 주의사항

- **orders/import DB 검증**: `SUPABASE_SERVICE_ROLE_KEY` 있을 때만 `ordersDbHelper`로 order/receiver row 개수 검증
- **미설정 시**: API 응답(successCount, failedCount, failed[])만 검증, 테스트는 통과
- **Preview/Test DB**: CI는 placeholder env 사용, 실제 검증은 preview 배포 + 별도 env로 수행
