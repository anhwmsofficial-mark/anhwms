# 🚨 긴급: Vercel 환경변수 설정 가이드

## 현재 문제

**에러**: `AuthApiError: Invalid API key`

이 에러는 Vercel에 Supabase 환경변수가 설정되지 않았거나 잘못 설정되어 발생합니다.

---

## ⚡ 빠른 해결 방법 (5분)

### Step 1: Supabase에서 키 확인 (1분)

1. **Supabase Dashboard 접속**
   - https://supabase.com
   - 프로젝트 선택 (jakrtoalfnxbjlrcdbeh)

2. **Settings → API 메뉴**

3. **다음 정보 복사:**
   ```
   Project URL: https://jakrtoalfnxbjlrcdbeh.supabase.co
   anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (전체 복사!)
   service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (전체 복사!)
   ```

⚠️ **중요**: 키를 복사할 때 **전체**를 복사해야 합니다! (보통 200자 이상)

---

### Step 2: Vercel에 환경변수 추가 (2분)

1. **Vercel Dashboard 접속**
   - https://vercel.com
   - `anhwms` 프로젝트 선택

2. **Settings → Environment Variables**

3. **다음 3개 환경변수 추가:**

   #### ✅ 환경변수 1: NEXT_PUBLIC_SUPABASE_URL
   ```
   Key: NEXT_PUBLIC_SUPABASE_URL
   Value: https://jakrtoalfnxbjlrcdbeh.supabase.co
   Environment: ☑ Production ☑ Preview ☑ Development
   ```

   #### ✅ 환경변수 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
   Key: NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (전체 키!)
   Environment: ☑ Production ☑ Preview ☑ Development
   ```

   #### ✅ 환경변수 3: SUPABASE_SERVICE_ROLE_KEY
   ```
   Key: SUPABASE_SERVICE_ROLE_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (전체 키!)
   Environment: ☑ Production ☑ Preview ☑ Development
   ```

4. **Save** 클릭

---

### Step 3: 재배포 확인 (2분)

1. **Vercel Dashboard → Deployments 탭**
2. **최신 배포가 자동으로 시작되는지 확인**
3. **배포 완료 대기** (약 1-2분)

---

### Step 4: 확인

1. **환경변수 확인 페이지 접속**
   - https://anhwms.vercel.app/admin/env-check
   - 모든 항목이 "✅ 유효함"으로 표시되는지 확인

2. **로그인 테스트**
   - https://anhwms.vercel.app/login
   - 테스트 계정으로 로그인 시도

---

## 🔍 문제 진단

### 환경변수 확인 페이지

🔗 **https://anhwms.vercel.app/admin/env-check**

이 페이지에서:
- ✅ 각 환경변수가 설정되어 있는지 확인
- ✅ 값이 올바른 형식인지 확인
- ✅ 문제 해결 가이드 확인

---

## ⚠️ 자주 하는 실수

### 실수 1: 키를 일부만 복사
- ❌ `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9` (일부만)
- ✅ `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impha3J0b2FsZm54YmpscmNkYmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MjE2MDAsImV4cCI6MjA1MDM5NzYwMH0.xxx...` (전체)

### 실수 2: 환경 선택 안 함
- ❌ Environment 선택 안 함
- ✅ Production, Preview, Development 모두 선택

### 실수 3: 재배포 안 함
- ❌ 환경변수만 추가하고 재배포 안 함
- ✅ 환경변수 추가 후 자동 재배포 대기 (또는 수동 재배포)

---

## 📋 체크리스트

환경변수 설정 후 확인:

- [ ] Supabase에서 Project URL 복사
- [ ] Supabase에서 anon public key 전체 복사 (200자 이상)
- [ ] Supabase에서 service_role key 전체 복사 (200자 이상)
- [ ] Vercel에 `NEXT_PUBLIC_SUPABASE_URL` 추가
- [ ] Vercel에 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가
- [ ] Vercel에 `SUPABASE_SERVICE_ROLE_KEY` 추가
- [ ] 모든 환경변수에 Production, Preview, Development 선택
- [ ] Vercel에서 Save 클릭
- [ ] 자동 재배포 완료 대기
- [ ] `/admin/env-check` 페이지에서 확인
- [ ] 로그인 테스트

---

## 🆘 여전히 안 되나요?

### 1. 환경변수 값 확인
- Vercel Dashboard → Settings → Environment Variables
- 각 환경변수 클릭하여 전체 값 확인
- 앞뒤 공백이 없는지 확인

### 2. 재배포 강제 실행
```bash
# Vercel Dashboard에서
Deployments → 최신 배포 → ... → Redeploy
```

### 3. 브라우저 캐시 클리어
- Ctrl + Shift + Delete
- 캐시된 이미지 및 파일 삭제
- 페이지 새로고침 (Ctrl + F5)

### 4. Vercel 로그 확인
- Vercel Dashboard → Deployments → 최신 배포 → Logs
- 에러 메시지 확인

---

## 📞 추가 도움

문제가 계속되면:
1. `/admin/env-check` 페이지 스크린샷
2. Vercel 환경변수 설정 스크린샷 (민감 정보 제외)
3. 브라우저 콘솔 에러 메시지

---

생성일: 2025-11-21
프로젝트: ANH WMS v2

