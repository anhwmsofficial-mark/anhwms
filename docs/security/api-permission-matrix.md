# API Permission Matrix (MVP 1차)

## 기준
- **Guarded**: `requirePermission`, `requireAdminUser`, `auth.getUser` 중 하나 이상 적용
- **Public**: 의도된 공개 라우트
- **NeedsGuard**: 인증/권한 가드 추가 필요

## Public (의도된 공개)
- `/api/external-quote`
- `/api/international-quote`
- `/api/quote/calculate`
- `/api/products/search`
- `/api/share/inbound`
- `/api/share/inventory`
- `/api/share/inventory/download`
- `/api/share/translate`

## 이번 적용으로 Guarded 전환
- `/api/orders/[id]`
- `/api/orders/[id]/logs`
- `/api/orders/import`
- `/api/cs/alerts`
- `/api/cs`
- `/api/cs/document`
- `/api/cs/glossary`
- `/api/cs/inventory`
- `/api/cs/status`
- `/api/cs/ticket`
- `/api/cs/translate`
- `/api/cron/alerts` (`CRON_SECRET` 기반 인증)
- `/api/global-fulfillment/orders`
- `/api/global-fulfillment/exceptions`
- `/api/global-fulfillment/stats`
- `/api/test-openai`

## 현재 NeedsGuard (후속 일괄 적용 대상)
- 없음 (MVP 범위 기준)

## 참고: 미들웨어 전역 보호 구간
- `/api/admin/**`는 `utils/supabase/middleware.ts`에서 로그인 + 활성 계정 + Admin 접근 권한을 강제
- `/api/**` 비공개 경로는 로그인 미존재 시 401 차단
- `/api/cron/alerts`는 `lib/auth/cronGuard.ts`의 `requireCronSecret()`으로 `CRON_SECRET` Bearer 인증을 강제

## 예외 라우트(의도적)
- `/api/cron/alerts`
  - 사용자 세션 기반 권한이 아닌, 서버 간 호출용 시크릿(`CRON_SECRET`)으로 보호
  - 운영 시 `CRON_SECRET` 미설정을 금지(배포 체크리스트 필수 항목)
- `/api/global-fulfillment/exceptions`
- `/api/global-fulfillment/orders`
- `/api/global-fulfillment/stats`

## 권장 기본 정책
- `app/api/admin/**`: `requirePermission('manage:*')` 또는 `requireAdminUser` 강제
- `app/api/cs/**`: 최소 `read:orders`, 쓰기 작업은 `manage:orders` 이상
- `app/api/orders/**`: 조회 `read:orders`, 변경 `manage:orders`
- `app/api/cron/**`: `CRON_SECRET` 필수
