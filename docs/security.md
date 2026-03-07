# ANH WMS 보안 정책

현재 코드 기준으로 실제 적용된 보안 정책을 정리한다.

---

## 1. 인증·권한

### 미들웨어 보호
- **파일**: `utils/supabase/middleware.ts`
- **보호 경로**: `/admin`, `/users`, `/dashboard`, `/inventory`, `/inbound`, `/outbound`, `/orders`, `/management`, `/operations`, `/settings`, `/ops`, `/portal/*`
- 비로그인 시 `/login?next=<path>` 리다이렉트
- 비활성/잠금 계정 시 로그인 페이지로 리다이렉트

### Admin 전용 경로
- `/admin`, `/users`, `/ops` 접근 시 `can_access_admin` 검증
- 미충족 시 `/dashboard` 리다이렉트

### API 보호
- `/api/admin/**`: 로그인 + 활성 계정 + Admin 권한 필수
- `/api/**` 비공개 경로: 로그인 필수 (공개 API 제외)
- 공개 API: `/api/external-quote`, `/api/international-quote`, `/api/quote/calculate`, `/api/products/search`, `/api/share/*`

---

## 2. Service Role 사용 원칙

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 (`lib/supabase-admin.ts`, `utils/supabase/admin.ts`)
- RLS 우회가 필요한 Admin/배치 작업에만 사용
- 클라이언트에 노출 금지

---

## 3. Tenant Ownership 검증

- RLS 정책으로 tenant_id 기반 접근 제어
- Admin API는 `set_config('app.tenant_id', ...)` 또는 org/tenant 컨텍스트로 쿼리 스코핑
- 관련 마이그레이션: `fix_confirm_inbound_receipt_tenant_id`, `hotfix_tenant_select_for_admin_access` 등

---

## 4. Share Route 보호

- `/api/share/inbound`, `/api/share/inventory`: slug 기반 공유 링크
- slug 검증 후 해당 tenant 데이터만 반환
- 내부 점검용 `/api/admin/inbound-share`, `/api/admin/inventory/volume/share`는 인증 필수

---

## 5. Rate Limit / Backoff

- **orders/import**: `lib/rate-limit.ts`의 `enforceRateLimit` 적용
- 분당 요청 제한, 초과 시 429 반환
- TODO: 다른 고부하 API 확대 적용 검토

---

## 6. Cron Fail-Closed

- **파일**: `lib/auth/cronGuard.ts`
- `CRON_SECRET` 미설정 시 503 반환 (fail-closed)
- Bearer 토큰으로 `CRON_SECRET` 검증
- 적용: `/api/cron/alerts`, `/api/cron/audit-retention` 등

---

## 7. Upload 제한 정책

- **파일**: `lib/upload/validation.ts`
- **재고 엑셀**: 최대 10MB, xlsx/xls/csv
- **주문 엑셀**: 최대 5MB, xlsx/xls
- **문서**: 최대 10MB, pdf/jpg/jpeg/png/webp
- MIME 타입·확장자 검증

---

## 8. 내부 점검 엔드포인트 운영 차단

| 경로 | Production 동작 |
|------|-----------------|
| `/admin/env-check` | 404 (미들웨어에서 차단) |
| `/api/test-openai` | 404 (route 내부에서 차단) |

- 차단 시 `Blocked internal diagnostics access` 로그 기록
- Admin 권한 있어도 production에서는 접근 불가

---

## 9. RequestId / 구조화 로그

- **파일**: `lib/api/response.ts`, `lib/api/request-log.ts`
- API 응답에 `requestId` 포함 (에러 시 클라이언트 노출 가능)
- `createRequestLogger`로 route, action, actor, tenantId, duration 로깅
- 운영: requestId로 로그 추적 가능

---

## 10. TODO / 후속 과제

- [ ] API 권한 매트릭스 전 구간 적용 검증 (`docs/security/api-permission-matrix.md`)
- [ ] 미들웨어 거부 시 구조화 보안 로그
- [ ] Playwright e2e 보안 스펙 (anonymous/admin/non-admin 접근 매트릭스)
