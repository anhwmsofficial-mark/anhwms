# 🔧 Vercel 환경변수 설정 가이드

## ❌ 현재 문제

로그인 시 "Invalid API key" 에러가 발생하는 이유:
- Vercel에 Supabase 환경변수가 설정되지 않았거나
- 잘못된 키가 설정되어 있습니다

---

## ✅ 해결 방법

### Step 1: Supabase에서 올바른 키 확인

1. **Supabase Dashboard 접속**
   - https://supabase.com 접속
   - 프로젝트 선택

2. **Settings → API 메뉴로 이동**

3. **다음 정보 확인:**
   - **Project URL**: `https://jakrtoalfnxbjlrcdbeh.supabase.co` (예시)
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (긴 문자열)
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (긴 문자열, 비밀!)

---

### Step 2: Vercel에 환경변수 설정

1. **Vercel Dashboard 접속**
   - https://vercel.com 접속
   - `anhwms` 프로젝트 선택

2. **Settings → Environment Variables 메뉴로 이동**

3. **다음 3개 환경변수 추가:**

   #### 환경변수 1: `NEXT_PUBLIC_SUPABASE_URL`
   - **Key**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: Supabase Project URL (예: `https://jakrtoalfnxbjlrcdbeh.supabase.co`)
   - **Environment**: Production, Preview, Development 모두 선택

   #### 환경변수 2: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: Supabase anon/public key (긴 문자열)
   - **Environment**: Production, Preview, Development 모두 선택

   #### 환경변수 3: `SUPABASE_SERVICE_ROLE_KEY`
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Supabase service_role key (긴 문자열, 비밀!)
   - **Environment**: Production, Preview, Development 모두 선택
   - ⚠️ **주의**: 이 키는 절대 공개하지 마세요!

4. **저장** 클릭

---

### Step 3: 재배포

환경변수를 추가한 후:

1. **자동 재배포** (권장)
   - Vercel이 자동으로 재배포를 시작합니다
   - Deployments 탭에서 진행 상황 확인

2. **수동 재배포** (필요시)
   ```bash
   vercel --prod
   ```

---

## 🔍 환경변수 확인 방법

### Vercel에서 확인
1. Settings → Environment Variables
2. 추가한 3개 환경변수가 모두 표시되는지 확인
3. 각 환경변수의 값이 올바른지 확인

### 배포 후 확인
1. 배포 완료 후 https://anhwms.vercel.app/login 접속
2. 브라우저 개발자 도구 (F12) → Console 탭
3. 에러가 사라졌는지 확인

---

## ⚠️ 주의사항

### 1. 키 복사 시 주의
- 키를 복사할 때 앞뒤 공백이 포함되지 않도록 주의
- 전체 키를 정확히 복사해야 합니다

### 2. 환경변수 이름 확인
- `NEXT_PUBLIC_` 접두사가 있는 변수는 클라이언트에서도 접근 가능
- `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용 (접두사 없음)

### 3. 키 보안
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 공개하지 마세요
- GitHub에 커밋하지 마세요
- `.env.local` 파일은 `.gitignore`에 포함되어 있어야 합니다

---

## 🐛 문제 해결

### 문제 1: 여전히 "Invalid API key" 에러
**해결:**
1. Vercel 환경변수 값이 정확한지 다시 확인
2. Supabase Dashboard에서 키를 다시 복사
3. 재배포 확인

### 문제 2: 환경변수가 적용되지 않음
**해결:**
1. Vercel에서 수동으로 재배포 실행
2. Deployments → 최신 배포 → Redeploy

### 문제 3: 로컬에서는 작동하는데 Vercel에서 안 됨
**해결:**
1. Vercel 환경변수가 Production 환경에 설정되어 있는지 확인
2. Preview, Development 환경에도 설정되어 있는지 확인

---

## ✅ 완료 체크리스트

- [ ] Supabase에서 Project URL 확인
- [ ] Supabase에서 anon/public key 확인
- [ ] Supabase에서 service_role key 확인
- [ ] Vercel에 `NEXT_PUBLIC_SUPABASE_URL` 추가
- [ ] Vercel에 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가
- [ ] Vercel에 `SUPABASE_SERVICE_ROLE_KEY` 추가
- [ ] 모든 환경변수에 Production, Preview, Development 선택
- [ ] Vercel 재배포 완료
- [ ] 로그인 페이지에서 에러 없이 로드되는지 확인

---

## 📞 추가 도움

문제가 계속되면:
1. Vercel 로그 확인: Deployments → 최신 배포 → Logs
2. 브라우저 콘솔 확인: F12 → Console
3. Supabase Dashboard → Logs 확인

---

생성일: 2025-11-21
프로젝트: ANH WMS v2

