# Deployment Environment Checklist

## Vercel / Server

배포 전에 Vercel Project Settings 또는 서버 환경변수에 아래 값을 등록합니다.

| Variable | Required | Purpose |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser/SSR Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser/SSR Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only admin access |
| `SUPABASE_FUNCTIONS_URL` | Yes | Supabase Edge Function base URL |
| `ANH_EDGE_INTERNAL_SECRET` | Yes | Internal server-to-Edge Function guard |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public share URL generation |
| `CRON_SECRET` | Yes | Cron endpoint authorization |
| `CI_SMOKE_BYPASS_TOKEN` | CI only | CI smoke bypass for selected routes |
| `OPENAI_API_KEY` | Optional | AI CS features |
| `OPENAI_CS_MODEL` | Optional | AI CS model override |

## Supabase Edge Function Secrets

Supabase Edge Functions에도 아래 값을 등록합니다.

| Secret | Required | Notes |
|---|---:|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Edge Function DB access |
| `ANH_EDGE_INTERNAL_SECRET` | Yes | Must match the Vercel/server value |

## Edge Functions To Redeploy

`ANH_EDGE_INTERNAL_SECRET` 검증이 추가된 뒤 아래 함수를 재배포합니다.

- `inventory-by-sku`
- `inbound-status`
- `outbound-status`
- `shipment-status`
- `document`
- `cs-ticket`

## Pre-Deploy Verification

```bash
npm run lint:ci
npm run typecheck:ci
npm run build
npm run test:api:smoke -- --reporter=line
```

## Post-Deploy Smoke

- `/portal/dashboard`가 로그인 후 404 없이 표시되는지 확인합니다.
- `/global-fulfillment`가 비로그인 상태에서 `/login?next=/global-fulfillment`로 이동하는지 확인합니다.
- 물동량/입고 공유 링크 생성 시 만료일이 비어 있으면 7일 만료로 생성되는지 확인합니다.
- CS 자동응답 도구 호출이 401이 아닌 정상 응답 또는 도메인 오류를 반환하는지 확인합니다.
