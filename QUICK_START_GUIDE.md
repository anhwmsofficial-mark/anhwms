# 🚀 ANH WMS 빠른 시작 가이드

> **목적**: 개발자가 5분 안에 로컬 환경에서 앱을 실행할 수 있도록 돕습니다.

---

## ✅ 사전 준비

### 1. 필수 소프트웨어 설치

- **Node.js** 20.x 이상 ([다운로드](https://nodejs.org/))
- **Git** ([다운로드](https://git-scm.com/))
- **코드 에디터** (VS Code 권장)

### 2. Supabase 계정 생성

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 회원가입 또는 로그인
3. 새 프로젝트 생성
   - 프로젝트명: `anh-wms` (또는 원하는 이름)
   - 데이터베이스 비밀번호: 안전한 비밀번호 설정
   - 지역: **Northeast Asia (Seoul)** 선택 권장

---

## 📦 1단계: 프로젝트 설정

### 저장소 클론 (또는 이미 다운로드한 경우 생략)

```bash
git clone https://github.com/anhwmsofficial-mark/anhwms.git
cd anhwms
```

### 의존성 설치

```bash
npm install
```

---

## 🔐 2단계: 환경 변수 설정

### 1) `.env.local` 파일 생성

```bash
# Windows
copy .env.example .env.local

# Mac/Linux
cp .env.example .env.local
```

### 2) Supabase 정보 가져오기

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. **Settings** → **API** 메뉴
4. 다음 정보 복사:
   - **Project URL** (예: `https://abcdefg.supabase.co`)
   - **anon public** 키

### 3) `.env.local` 파일 수정

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# 나머지는 선택 사항 (일단 비워두어도 됨)
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

---

## 🗄️ 3단계: 데이터베이스 스키마 적용

### 1) Supabase SQL Editor 열기

1. Supabase Dashboard → **SQL Editor**
2. **New query** 클릭

### 2) 기본 스키마 실행

`supabase-schema.sql` 파일 내용을 복사하여 붙여넣고 **Run** 클릭

### 3) 추가 스키마 실행 (선택 사항)

**AI CS 기능을 사용하려면:**
- `supabase-cs-schema.sql` 실행

**글로벌 풀필먼트 기능을 사용하려면:**
- `supabase-global-fulfillment-schema.sql` 실행

**주문 배송 연동 기능을 사용하려면:**
- `supabase-orders-schema.sql` 실행 (이미 기본 스키마에 포함됨)

---

## 🚀 4단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 자동으로 열립니다: [http://localhost:3000](http://localhost:3000)

---

## ✅ 5단계: 동작 확인

### 대시보드 확인

- 로컬 서버가 실행되면 대시보드가 표시됩니다
- 샘플 데이터가 로드됩니다 (제품, 입출고 내역 등)

### 주요 페이지 테스트

- **재고 관리**: [http://localhost:3000/inventory](http://localhost:3000/inventory)
- **입고 관리**: [http://localhost:3000/inbound](http://localhost:3000/inbound)
- **출고 관리**: [http://localhost:3000/outbound](http://localhost:3000/outbound)

---

## 🐛 문제 해결

### 1. "환경 변수가 누락되었습니다" 오류

**원인**: `.env.local` 파일이 없거나 값이 잘못됨

**해결**:
```bash
# .env.local 파일이 있는지 확인
ls -la .env.local  # Mac/Linux
dir .env.local      # Windows

# 파일 내용 확인
cat .env.local     # Mac/Linux
type .env.local    # Windows

# Supabase URL과 키가 올바른지 확인
```

### 2. "테이블을 찾을 수 없습니다" 오류

**원인**: 데이터베이스 스키마가 적용되지 않음

**해결**:
1. Supabase Dashboard → SQL Editor
2. `supabase-schema.sql` 다시 실행
3. 브라우저 새로고침 (F5)

### 3. "데이터가 표시되지 않습니다"

**원인**: RLS(Row Level Security) 정책 문제

**해결**:
```sql
-- Supabase SQL Editor에서 실행
-- 임시로 모든 정책 비활성화 (개발 환경만)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE inbounds DISABLE ROW LEVEL SECURITY;
ALTER TABLE outbounds DISABLE ROW LEVEL SECURITY;
```

### 4. 포트 3000이 이미 사용 중

**해결**:
```bash
# 다른 포트로 실행
PORT=3001 npm run dev

# 또는 3000 포트 사용 중인 프로세스 종료 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### 5. "Module not found" 오류

**해결**:
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json  # Mac/Linux
rmdir /s /q node_modules & del package-lock.json  # Windows

npm install
```

---

## 📚 다음 단계

### 개발 시작

1. **코드 구조 파악**: `README.md` 참고
2. **사용자 가이드**: `USER_GUIDE.md` 참고
3. **개선점 체크리스트**: `IMPROVEMENT_CHECKLIST.md` 확인

### 주요 기능 탐색

- **Ops 보드**: 작업 현황 관리
- **My Tasks**: 개인 작업 관리
- **주문 업로드**: Excel 파일 업로드 및 배송 연동
- **AI CS**: 중국어/한국어 자동 번역 및 응답

### 프로덕션 배포

- **Vercel 배포**: `DEPLOYMENT.md` 참고
- **OpenAI 설정**: `OPENAI_SETUP.md` 참고
- **바코드 스캐너**: `BARCODE_SCANNER_GUIDE.md` 참고

---

## 🆘 도움말

### 문서

- [README.md](./README.md) - 프로젝트 개요
- [USER_GUIDE.md](./USER_GUIDE.md) - 사용자 매뉴얼
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Vercel 배포 가이드
- [IMPROVEMENT_CHECKLIST.md](./IMPROVEMENT_CHECKLIST.md) - 개선점 체크리스트

### 커뮤니티

- GitHub Issues: [https://github.com/anhwmsofficial-mark/anhwms/issues](https://github.com/anhwmsofficial-mark/anhwms/issues)
- 개발자 이메일: support@anhwms.com

---

## ⏱️ 예상 소요 시간

| 단계 | 시간 |
|------|------|
| 1. 프로젝트 설정 | 1분 |
| 2. 환경 변수 설정 | 2분 |
| 3. 데이터베이스 스키마 | 1분 |
| 4. 개발 서버 실행 | 1분 |
| **총 소요 시간** | **약 5분** |

---

**🎉 축하합니다! ANH WMS를 성공적으로 실행했습니다!**

이제 코드를 수정하고 기능을 추가할 준비가 되었습니다. 행운을 빕니다! 🚀


