# ANH WMS 배포 체크리스트

운영 배포 전·후 확인 항목을 정리한다.

---

## 1. Production에서 열리면 안 되는 Route

| 경로 | 보호 방식 |
|------|-----------|
| `/admin/env-check` | 미들웨어에서 production 시 404 |
| `/api/test-openai` | route 내부에서 production 시 404 |

---

## 2. env-check / test-openai 정책

- **env-check**: 환경 변수 점검용 페이지. Production에서는 완전 비활성화.
- **test-openai**: OpenAI 연결 테스트용 API. Production에서는 404 반환.
- 두 경로 모두 Admin 권한 있어도 production 접근 불가.

---

## 3. 배포 전 확인 항목

- [ ] 환경 변수 설정
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - (Cron 사용 시) `CRON_SECRET`
- [ ] Supabase 마이그레이션 적용 완료
- [ ] `npm run build` 성공
- [ ] `npm run smoke:ci` (로컬 또는 preview 대상) 통과

---

## 4. 배포 후 Smoke Check 항목

- [ ] `/api/health` 200, `ok: true`
- [ ] `/api/health/import-staging` 200
- [ ] 보호된 페이지 (`/admin`, `/dashboard`) 로그인 후 접근 가능
- [ ] `/admin/env-check` production에서 404

---

## 5. 보안/권한/공유 기본 점검

- [ ] 비로그인 시 `/admin` → `/login` 리다이렉트
- [ ] Admin 권한 없는 계정으로 `/admin` → `/dashboard` 리다이렉트
- [ ] `/api/admin/*` 비인증 시 401
- [ ] Share 경로 (`/api/share/inbound`, `/api/share/inventory`) slug 검증 동작
