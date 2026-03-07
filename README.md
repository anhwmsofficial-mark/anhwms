# ANH WMS - 창고 관리 시스템

Next.js 기반의 현대적인 창고 관리 시스템 (Warehouse Management System)

## 프로젝트 개요

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 프로덕션 빌드

```bash
npm run build
npm start
```

## 환경 변수 개요

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key |

**서버 전용 (권장)**:
| 변수 | 용도 |
|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API, 배치 작업 |
| `CRON_SECRET` | Cron 엔드포인트 인증 (`/api/cron/*`) |

`.env.local`에 설정 후 사용. 상세는 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 참고.

## 주요 디렉토리 구조

```
app/
├── (admin)/          # 관리자/CS/검수 화면 (사이드바 포함)
│   ├── admin/        # Admin 전용 (고객사, 브랜드, 창고, 주문 등)
│   ├── cs/           # CS 패널
│   ├── global-fulfillment/  # 풀필먼트 운영
│   ├── inbound/      # 입고
│   ├── inventory/    # 재고
│   ├── orders/       # 주문
│   ├── dashboard/    # 대시보드
│   ├── error.tsx     # (admin) 세그먼트 에러 fallback
│   └── loading.tsx   # (admin) 세그먼트 로딩
├── (auth)/           # 로그인/로그아웃
├── (portal)/         # 포털
├── share/            # 공유 링크 (inbound, inventory)
├── api/              # API Routes
├── error.tsx         # 전역 에러 fallback
└── loading.tsx       # 전역 로딩

lib/                  # 유틸, API 클라이언트, 스키마
├── api/              # API 응답/에러 포맷
├── httpToast.ts      # API 에러 → Toast (인라인 에러)
└── upload/           # 업로드 검증 정책

utils/supabase/       # middleware, server client
```

## 관리자/공유/업로드/테스트 관련 구조

- **관리자**: `/admin/*`, `/users`, `/ops` (미들웨어 + `can_access_admin` 검증)
- **공유**: `/api/share/inbound`, `/api/share/inventory` (slug 기반)
- **업로드**: `lib/upload/validation.ts` (재고 10MB, 주문 5MB, 문서 10MB)
- **테스트**: `npm run smoke:ci`, `npm run test:api` — [docs/testing.md](./docs/testing.md)

## Preview / Production 차이

- **Preview**: `/admin/env-check`, `/api/test-openai` 접근 가능 (Admin 권한 필요)
- **Production**: 위 두 경로 404 반환 (내부 점검용)

## 추가 문서

| 문서 | 내용 |
|------|------|
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | 배포 가이드 |
| [docs/security.md](./docs/security.md) | 보안 정책 |
| [docs/testing.md](./docs/testing.md) | 테스트 실행·CI |
| [docs/deployment-checklist.md](./docs/deployment-checklist.md) | 배포 체크리스트 |
| [docs/roadmap-tech-debt.md](./docs/roadmap-tech-debt.md) | 후순위 과제 |
| [docs/ci/orders-import-tests.md](./docs/ci/orders-import-tests.md) | orders/import 테스트 |
| [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md) | 빠른 시작 |
| [IMPROVEMENT_CHECKLIST.md](./IMPROVEMENT_CHECKLIST.md) | 개선 체크리스트 |

## 프로덕션 배포 전 확인

- [ ] 환경 변수 설정
- [ ] Supabase 마이그레이션 적용
- [ ] `docs/deployment-checklist.md` 확인
