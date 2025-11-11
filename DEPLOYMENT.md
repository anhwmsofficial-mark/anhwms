# ANH WMS Vercel 배포 가이드

## 1. Vercel 프로젝트 연결

### 방법 1: Vercel CLI 사용

```bash
# Vercel CLI 설치 (전역)
npm i -g vercel

# 로그인
vercel login

# 프로젝트 배포 (최초)
vercel

# 프로덕션 배포
vercel --prod
```

### 방법 2: Vercel Dashboard 사용

1. [Vercel Dashboard](https://vercel.com/dashboard)에 접속
2. "Add New Project" 클릭
3. GitHub 저장소 연결: `anhwmsofficial-mark/anhwms`
4. 프레임워크 프리셋: **Next.js** (자동 감지됨)
5. Root Directory: `.` (기본값)
6. Build Command: `npm run build` (기본값)
7. Output Directory: `.next` (기본값)

---

## 2. 환경 변수 설정

Vercel Dashboard → 프로젝트 → Settings → Environment Variables

### 필수 환경 변수

```bash
# Supabase 기본 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Admin (서버 사이드)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### AI CS 통합 모듈 추가 환경 변수 (선택)

```bash
# Supabase Edge Functions URL
SUPABASE_FUNCTIONS_URL=https://your-project-id.supabase.co/functions/v1

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 환경별 설정

- **Production**: 프로덕션 환경에서만 사용
- **Preview**: PR/브랜치 배포 시 사용
- **Development**: 로컬 개발 환경 (`.env.local` 파일 사용 권장)

---

## 3. 빌드 오류 해결

### 현재 빌드 이슈

프로젝트에 `.env.local` 파일이 없거나 환경 변수가 설정되지 않은 경우 빌드 에러가 발생합니다.

#### 해결 방법

**로컬 빌드 테스트:**

`.env.local` 파일을 프로젝트 루트에 생성하고 위의 환경 변수를 추가:

```bash
# .env.local (Git에 커밋되지 않음)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

그 후 빌드:

```bash
npm run build
```

**Vercel 배포:**

Vercel Dashboard에서 환경 변수를 설정하면 자동으로 빌드 시 적용됩니다.

---

## 4. Supabase 데이터베이스 스키마 적용

배포 전 Supabase 프로젝트에 스키마를 적용해야 합니다.

### Supabase Dashboard에서 SQL 실행

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. **SQL Editor** 메뉴 클릭
4. "New query" 클릭

#### 기본 WMS 스키마 적용

`supabase-schema.sql` 파일 내용을 복사하여 실행

#### AI CS 통합 스키마 적용

`supabase-cs-schema.sql` 파일 내용을 복사하여 실행

---

## 5. Vercel 배포 트리거

### 자동 배포

- **main/master 브랜치 푸시**: 프로덕션 배포
- **다른 브랜치 푸시/PR**: 프리뷰 배포

### 수동 배포

```bash
# CLI로 프로덕션 배포
vercel --prod

# 또는 Vercel Dashboard → Deployments → Redeploy
```

---

## 6. 배포 후 확인 사항

### 체크리스트

- [ ] 앱이 정상적으로 로드되는지 확인
- [ ] Supabase 연결 확인 (대시보드 데이터 표시)
- [ ] API 라우트 동작 확인 (`/api/cs`, `/api/cs/translate`)
- [ ] CS 통합 페이지 접근 (`/cs`)
- [ ] 환경 변수가 올바르게 설정되었는지 확인

### 오류 로그 확인

Vercel Dashboard → 프로젝트 → Deployments → 배포 선택 → **Function Logs** 또는 **Build Logs**

---

## 7. 도메인 설정 (선택)

Vercel Dashboard → 프로젝트 → Settings → Domains

- Vercel 기본 도메인: `your-project.vercel.app`
- 커스텀 도메인 연결 가능

---

## 8. Supabase Edge Functions 배포 (선택)

AI CS 통합 모듈에서 Edge Functions를 사용하는 경우:

```bash
# Supabase CLI 설치
npm i -g supabase

# Supabase 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref your-project-id

# Edge Functions 배포
supabase functions deploy shipment-status
supabase functions deploy outbound-status
supabase functions deploy inbound-status
supabase functions deploy inventory-by-sku
supabase functions deploy document
supabase functions deploy cs-ticket
```

---

## 9. 문제 해결

### 빌드 실패

- 환경 변수 누락 → Vercel Dashboard에서 확인/추가
- TypeScript 오류 → 로컬에서 `npm run build` 테스트
- Supabase 연결 실패 → URL 및 키 확인

### 런타임 오류

- Function Logs에서 에러 메시지 확인
- Supabase RLS 정책 확인 (권한 문제)
- API 라우트 응답 상태 코드 확인

---

## 10. 추가 리소스

- [Vercel 문서](https://vercel.com/docs)
- [Next.js 배포 가이드](https://nextjs.org/docs/app/building-your-application/deploying)
- [Supabase 문서](https://supabase.com/docs)

---

**참고**: 프로젝트는 Next.js 16 (App Router) 및 Turbopack을 사용합니다. Vercel은 이를 자동으로 지원합니다.

