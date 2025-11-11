# OpenAI API 설정 가이드

## 📋 목차
1. [API 키 발급](#1-api-키-발급)
2. [환경 변수 설정](#2-환경-변수-설정)
3. [요금 및 모델 선택](#3-요금-및-모델-선택)
4. [사용량 모니터링](#4-사용량-모니터링)
5. [보안 권장사항](#5-보안-권장사항)

---

## 1. API 키 발급

### 단계별 가이드

1. **OpenAI Platform 접속**
   - URL: https://platform.openai.com/
   - 계정이 없으면 회원가입

2. **API Keys 메뉴**
   - 왼쪽 메뉴 → **API keys** 클릭
   - 또는 직접 접속: https://platform.openai.com/api-keys

3. **새 키 생성**
   - **"Create new secret key"** 버튼 클릭
   - 키 이름 입력: `ANH_WMS_Production` (또는 원하는 이름)
   - **Permissions**: 기본값 (All) 또는 필요한 권한만 선택

4. **키 복사**
   - 생성된 키는 **한 번만 표시**됩니다
   - 반드시 안전한 곳에 저장하세요
   - 형식: `sk-proj-...` 또는 `sk-...`

### 키 유형

- **Project API Key** (권장): 특정 프로젝트에만 적용
- **User API Key**: 모든 프로젝트에 사용 (보안상 비권장)

---

## 2. 환경 변수 설정

### 로컬 개발 환경

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# .env.local
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Vercel 프로덕션 환경

1. **Vercel Dashboard** 접속
2. 프로젝트 선택
3. **Settings** → **Environment Variables**
4. 새 변수 추가:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-proj-...`
   - **Environments**: 
     - ✅ Production
     - ✅ Preview (선택)
     - ✅ Development (선택)
5. **Save** 클릭

### Supabase Edge Functions (선택)

Edge Functions에서도 OpenAI를 사용하려면:

```bash
# Supabase Dashboard → Project Settings → Edge Functions → Secrets
supabase secrets set OPENAI_API_KEY=sk-proj-...
```

---

## 3. 요금 및 모델 선택

### 추천 모델

#### 1. **GPT-4o-mini** (권장 - 경제적)

```typescript
model: 'gpt-4o-mini'
```

- **가격**:
  - Input: $0.150 / 1M tokens (~₩200)
  - Output: $0.600 / 1M tokens (~₩800)
- **속도**: 매우 빠름
- **용도**: 
  - 일반 CS 응답
  - 간단한 Intent 감지
  - 기본 번역

#### 2. **GPT-4o** (고성능)

```typescript
model: 'gpt-4o'
```

- **가격**:
  - Input: $5.00 / 1M tokens (~₩6,700)
  - Output: $15.00 / 1M tokens (~₩20,000)
- **속도**: 빠름
- **용도**:
  - 복잡한 비즈니스 로직
  - 높은 정확도 필요 시
  - 전문 용어 번역

#### 3. **GPT-4-turbo** (구형, 비권장)

- GPT-4o가 더 빠르고 저렴함

### 예상 비용 계산

#### 시나리오 1: 소규모 운영
- **일평균 CS 문의**: 50건
- **평균 토큰**: 500 tokens/건 (Input 300, Output 200)
- **모델**: GPT-4o-mini

**월 비용**:
- Input: 50 × 30 × 300 / 1,000,000 × $0.15 ≈ **$0.07**
- Output: 50 × 30 × 200 / 1,000,000 × $0.60 ≈ **$0.18**
- **총 월 비용**: ~**$0.25** (₩350)

#### 시나리오 2: 중규모 운영
- **일평균 CS 문의**: 200건
- **평균 토큰**: 700 tokens/건 (Input 400, Output 300)
- **모델**: GPT-4o-mini

**월 비용**:
- Input: 200 × 30 × 400 / 1,000,000 × $0.15 ≈ **$0.36**
- Output: 200 × 30 × 300 / 1,000,000 × $0.60 ≈ **$1.08**
- **총 월 비용**: ~**$1.44** (₩2,000)

#### 시나리오 3: 대규모 운영
- **일평균 CS 문의**: 1,000건
- **평균 토큰**: 1,000 tokens/건
- **모델**: GPT-4o

**월 비용**:
- Input: 1,000 × 30 × 600 / 1,000,000 × $5 ≈ **$90**
- Output: 1,000 × 30 × 400 / 1,000,000 × $15 ≈ **$180**
- **총 월 비용**: ~**$270** (₩360,000)

### 비용 절감 팁

1. **토큰 최적화**
   - 시스템 프롬프트 간결화
   - 불필요한 컨텍스트 제거
   - 템플릿 응답 최대 활용

2. **모델 선택**
   - 간단한 작업: GPT-4o-mini
   - 복잡한 작업: GPT-4o

3. **캐싱 활용**
   - 동일 질문 캐싱
   - 템플릿 응답 DB 저장

4. **Temperature 조절**
   - 사실 기반 응답: `temperature: 0.2`
   - 창의적 응답: `temperature: 0.7`

---

## 4. 사용량 모니터링

### OpenAI Dashboard

1. **Usage 페이지**: https://platform.openai.com/usage
2. 실시간 토큰 사용량 확인
3. 월별 비용 추적

### 사용량 제한 설정

1. **Organization Settings** → **Limits**
2. **Monthly budget**: 월 예산 설정 (예: $50)
3. **Email alerts**: 80%, 100% 도달 시 알림

### 프로젝트 코드에서 모니터링

```typescript
// lib/openai.ts에 추가
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
});

// 토큰 사용량 로그
console.log('Tokens used:', {
  prompt: response.usage?.prompt_tokens,
  completion: response.usage?.completion_tokens,
  total: response.usage?.total_tokens,
});

// Supabase에 사용량 저장 (선택)
await supabase.from('openai_usage_logs').insert({
  model: 'gpt-4o-mini',
  prompt_tokens: response.usage?.prompt_tokens,
  completion_tokens: response.usage?.completion_tokens,
  cost_usd: calculateCost(response.usage),
});
```

---

## 5. 보안 권장사항

### ✅ DO (권장)

- ✅ `.env.local`을 `.gitignore`에 추가 (이미 포함됨)
- ✅ Vercel 환경 변수로 키 관리
- ✅ 프로젝트별 키 사용
- ✅ 정기적으로 키 교체 (3-6개월)
- ✅ 사용량 모니터링 및 예산 설정

### ❌ DON'T (금지)

- ❌ 코드에 API 키 직접 입력
- ❌ 공개 저장소에 키 커밋
- ❌ 여러 프로젝트에서 동일 키 공유
- ❌ User API Key 사용 (Project Key 권장)

### 키 유출 시 대응

1. **즉시 키 삭제**
   - OpenAI Dashboard → API keys → 해당 키 **Revoke**

2. **새 키 생성 및 교체**
   - 새 키 생성 → 환경 변수 업데이트

3. **사용량 확인**
   - 비정상 사용 여부 체크

---

## 6. ANH WMS에서 OpenAI 사용 위치

### 1. CS 대화 API (`/app/api/cs/route.ts`)

```typescript
import { openai, CS_SYSTEM_PROMPT } from '@/lib/openai';

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  temperature: 0.2,
  messages: [
    { role: 'system', content: CS_SYSTEM_PROMPT },
    { role: 'user', content: payload.message },
  ],
  functions: toolSchemas, // Intent 감지용
});
```

### 2. Quick Translate API (`/app/api/cs/translate/route.ts`)

```typescript
import { openai, getTranslatePrompt } from '@/lib/openai';

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  temperature: 0.3,
  messages: [
    { 
      role: 'system', 
      content: getTranslatePrompt(sourceLang, targetLang, tone) 
    },
    { role: 'user', content: sourceText },
  ],
});
```

---

## 7. 테스트

### API 키 테스트

```bash
# 환경 변수 확인
echo $OPENAI_API_KEY

# 간단한 테스트
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Next.js API 라우트 테스트

```bash
# 로컬 서버 실행
npm run dev

# CS API 테스트
curl -X POST http://localhost:3000/api/cs \
  -H "Content-Type: application/json" \
  -d '{
    "partnerId": "test-partner-id",
    "channel": "chat",
    "lang": "zh",
    "message": "我的货到哪了？"
  }'
```

---

## 8. 문제 해결

### 오류: "Incorrect API key provided"

- API 키가 잘못되었거나 만료됨
- OpenAI Dashboard에서 키 확인

### 오류: "Rate limit exceeded"

- 무료 티어 제한 초과
- **Usage tier** 확인: https://platform.openai.com/settings/organization/limits
- 결제 정보 등록 또는 요청 빈도 감소

### 오류: "Insufficient quota"

- 계정 크레딧 부족
- **Billing** → **Add payment method**

### 높은 비용 발생

- 토큰 사용량 확인 (Usage 페이지)
- 모델을 GPT-4o-mini로 변경
- Temperature 낮추기
- 프롬프트 최적화

---

## 9. 참고 자료

- [OpenAI Platform](https://platform.openai.com/)
- [API 문서](https://platform.openai.com/docs/api-reference)
- [요금표](https://openai.com/api/pricing/)
- [모델 비교](https://platform.openai.com/docs/models)

---

**참고**: ANH WMS는 OpenAI SDK가 설치되어 있으며, `lib/openai.ts`에 기본 설정이 준비되어 있습니다.

