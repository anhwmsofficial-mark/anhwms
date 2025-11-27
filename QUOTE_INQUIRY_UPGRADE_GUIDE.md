# 견적 문의 관리 시스템 업그레이드 가이드

## 📋 개요

견적 문의 관리 시스템을 실제 운영 환경에 맞게 대폭 업그레이드했습니다.
기존의 기본적인 상태 관리에서 완전한 워크플로우 관리 시스템으로 진화했습니다.

**업그레이드 일자**: 2025년 11월 27일  
**마이그레이션 파일**: `migrations/17_quote_inquiry_enhancement.sql`

---

## ✨ 주요 개선사항

### 1. 세분화된 상태 체계

기존 5개 → 신규 8개 상태로 확장

| 상태 | 코드 | 설명 | 전환 시점 |
|------|------|------|-----------|
| 신규 | `new` | 고객이 폼 제출한 원본 상태 | 자동 생성 |
| 확인됨 | `checked` | 담당자가 열람함 | 운영자 클릭 |
| 상담중 | `processing` | 견적 산정 중, 추가 문의 중 | 운영자 |
| 견적 발송 | `quoted` | 견적서 PDF 발송 완료 | 운영자 or 자동 |
| 고객 검토중 | `pending` | 고객 회신 대기 | 자동/수동 |
| 수주 | `won` | 수행 확정 | 운영자 |
| 미수주 | `lost` | 고객 취소/타사 선정 | 운영자 |
| 보류 | `on_hold` | 일정 미정/추후 재확인 | 운영자 |

### 2. 운영자 메모 시스템

- **테이블**: `inquiry_notes`
- **기능**:
  - 운영자끼리 공유하는 내부 메모
  - 실시간 메모 추가/삭제
  - 작성자, 작성 시간 자동 기록
  - 메모 히스토리 관리

### 3. 견적서 파일 관리

- PDF, DOC, DOCX 파일 업로드 (최대 10MB)
- 파일 업로드 시 자동으로 '견적 발송' 상태로 변경
- 발송 일시 자동 기록
- 파일 다운로드 기능

### 4. 담당자 지정 시스템

- 관리자에게 문의 건 배정
- 담당자별 필터링
- 미배정 건 관리

### 5. 고급 필터링 시스템

- **검색**: 회사명, 담당자, 이메일, 연락처
- **상태 필터**: 8가지 상태별 필터링
- **담당자 필터**: 담당자별 + 미배정 건
- **날짜 필터**: 시작일~종료일 범위 검색
- **필터 초기화**: 원클릭 리셋

### 6. 상세 Side Drawer

- 기존 모달 → 오른쪽 슬라이드 패널로 변경
- 스크롤 가능한 넓은 화면
- 섹션별 정보 구조화:
  - 현재 상태 & 워크플로우 버튼
  - 담당자 지정
  - 기본 정보
  - 물량 및 상품 정보
  - 고객 요청사항
  - 견적서 관리
  - 운영자 메모
  - 메타 정보

### 7. 실시간 통계 대시보드

- 8개 상태별 실시간 카운트
- 클릭하여 해당 상태로 필터링
- 시각적 강조 효과

---

## 🗄️ 데이터베이스 변경사항

### 기존 테이블 수정: `external_quote_inquiry`

```sql
-- 새로 추가된 컬럼
ALTER TABLE external_quote_inquiry 
ADD COLUMN assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
ADD COLUMN quote_file_url TEXT,
ADD COLUMN quote_sent_at TIMESTAMPTZ,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- 상태 확장
ALTER TABLE external_quote_inquiry DROP CONSTRAINT external_quote_inquiry_status_check;
ALTER TABLE external_quote_inquiry
ADD CONSTRAINT external_quote_inquiry_status_check CHECK (
  status IN ('new', 'checked', 'processing', 'quoted', 'pending', 'won', 'lost', 'on_hold')
);
```

### 새 테이블: `inquiry_notes`

```sql
CREATE TABLE inquiry_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  inquiry_id UUID NOT NULL,
  inquiry_type TEXT NOT NULL CHECK (inquiry_type IN ('external', 'international')),
  admin_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 자동 업데이트 트리거

- `external_quote_inquiry.updated_at` 자동 갱신
- `international_quote_inquiry.updated_at` 자동 갱신
- `inquiry_notes.updated_at` 자동 갱신

---

## 🚀 배포 절차

### 1. 데이터베이스 마이그레이션

Supabase SQL Editor에서 실행:

```bash
# 마이그레이션 파일 실행
migrations/17_quote_inquiry_enhancement.sql
```

**주의사항**:
- 기존 상태 값 자동 변환:
  - `in_progress` → `processing`
  - `closed_won` → `won`
  - `closed_lost` → `lost`

### 2. 코드 변경사항

#### 새로 추가된 파일

```
lib/api/
  ├── inquiryNotes.ts                    # 메모 API
  └── adminUsers.ts                       # 관리자 목록 API

app/api/admin/
  ├── users/route.ts                      # 관리자 목록 엔드포인트
  └── quote-inquiries/
      ├── [id]/notes/route.ts             # 메모 CRUD
      └── notes/[noteId]/route.ts         # 메모 수정/삭제
```

#### 수정된 파일

```
types/index.ts                            # QuoteInquiryStatus 타입 확장
lib/api/externalQuotes.ts                 # 새 필드 지원
app/admin/quote-inquiries/page.tsx        # 전면 리뉴얼
app/api/admin/quote-inquiries/[id]/route.ts  # 새 필드 업데이트 지원
```

### 3. 환경 변수 확인

특별한 환경 변수 추가 없음 (기존 Supabase 설정 사용)

### 4. 배포 후 확인사항

- [ ] 마이그레이션이 성공적으로 실행되었는지 확인
- [ ] 기존 견적 문의 데이터가 정상적으로 조회되는지 확인
- [ ] 상태 변경이 정상 동작하는지 확인
- [ ] 메모 추가/삭제가 정상 동작하는지 확인
- [ ] 담당자 지정이 정상 동작하는지 확인
- [ ] 필터링이 정상 동작하는지 확인

---

## 📖 사용 가이드

### 일반적인 운영 흐름

```
1. 신규 견적 문의 접수 (자동)
   ↓
2. 운영자가 확인 → [확인됨] 상태로 변경
   ↓
3. 담당자 지정 (드롭다운)
   ↓
4. 내부 메모 작성 (고객 요구사항 정리)
   ↓
5. 견적 산정 → [상담중] 상태로 변경
   ↓
6. 견적서 PDF 업로드 → 자동으로 [견적 발송] 상태로 변경
   ↓
7. 고객 검토 대기 → [고객 검토중] 상태로 변경
   ↓
8-A. 수주 확정 → [수주] 상태로 변경
8-B. 미수주 → [미수주] 상태로 변경
8-C. 일정 미정 → [보류] 상태로 변경
```

### 워크플로우 버튼 사용

상세 패널 상단의 워크플로우 버튼은 단계별로 그룹화되어 있습니다:

```
[신규] [확인됨]
[상담중]
[견적 발송] [고객 검토중]
[수주] [미수주]
[보류]
```

현재 상태는 회색으로 비활성화되며, 다른 버튼을 클릭하여 상태를 변경할 수 있습니다.

### 메모 작성 팁

운영자 메모는 다음과 같은 정보를 기록하는 것이 좋습니다:

- 고객 추가 요구사항
- 견적 산정 근거
- 경쟁사 비교 정보
- 특이사항
- 후속 조치 필요사항

### 필터 활용

**시나리오 1: 내가 담당하는 신규 건만 보기**
- 상태 필터: `신규`
- 담당자 필터: `[내 이름]`

**시나리오 2: 이번 주 접수된 미배정 건**
- 날짜 필터: `시작일 = 이번 주 월요일`
- 담당자 필터: `미배정`

**시나리오 3: 수주 확정된 건 통계**
- 상태 필터: `수주`
- 날짜 필터: `이번 달 1일 ~ 오늘`

---

## 🔧 기술 상세

### 새로운 API 엔드포인트

#### 1. 메모 조회
```http
GET /api/admin/quote-inquiries/{id}/notes?type=external
```

#### 2. 메모 추가
```http
POST /api/admin/quote-inquiries/{id}/notes
Body: { "note": "메모 내용", "inquiryType": "external" }
```

#### 3. 메모 삭제
```http
DELETE /api/admin/quote-inquiries/notes/{noteId}
```

#### 4. 문의 업데이트 (확장)
```http
PATCH /api/admin/quote-inquiries/{id}
Body: {
  "status": "quoted",
  "assignedTo": "user-uuid",
  "quoteFileUrl": "https://...",
  "quoteSentAt": "2025-11-27T10:00:00Z"
}
```

#### 5. 관리자 목록
```http
GET /api/admin/users
```

### 타입 정의

```typescript
// 상태 타입
export type QuoteInquiryStatus =
  | 'new'
  | 'checked'
  | 'processing'
  | 'quoted'
  | 'pending'
  | 'won'
  | 'lost'
  | 'on_hold';

// 메모 인터페이스
export interface InquiryNote {
  id: string;
  inquiryId: string;
  inquiryType: 'external' | 'international';
  adminId: string;
  adminName?: string;
  note: string;
  createdAt: Date;
  updatedAt?: Date | null;
}

// 견적 문의 인터페이스 (확장)
export interface ExternalQuoteInquiry {
  // ... 기존 필드 ...
  assignedTo?: string | null;
  quoteFileUrl?: string | null;
  quoteSentAt?: Date | null;
  updatedAt?: Date | null;
}
```

---

## 🎯 향후 개선 계획

### Phase 2 (선택사항)

1. **이메일 자동 발송**
   - 상태 변경 시 고객에게 자동 알림
   - 견적서 발송 시 이메일 첨부

2. **알림 시스템**
   - 신규 문의 알림
   - 오래된 미처리 건 알림
   - 담당자 변경 알림

3. **통계 및 리포트**
   - 수주율 분석
   - 담당자별 성과
   - 월별 트렌드

4. **고객사 전환**
   - 수주 확정 시 `customer_master`로 자동 전환
   - 거래처 관리와 연동

---

## ❓ FAQ

### Q1. 기존 데이터는 어떻게 되나요?

기존 견적 문의 데이터는 그대로 유지되며, 상태 값만 자동으로 변환됩니다:
- `in_progress` → `processing`
- `closed_won` → `won`
- `closed_lost` → `lost`

### Q2. 파일 업로드는 어디에 저장되나요?

현재 구현에서는 임시로 파일 URL만 저장합니다.
실제 운영 시에는 Supabase Storage를 설정하여 파일을 업로드해야 합니다.

```typescript
// 실제 구현 예시 (주석 처리된 부분 참고)
const { data, error } = await supabase.storage
  .from('quote-files')
  .upload(`${inquiryId}/${file.name}`, file);
```

### Q3. 국제 배송 견적도 동일하게 적용되나요?

네, `international_quote_inquiry` 테이블도 동일하게 업그레이드되었습니다.
UI는 현재 `external` 타입만 표시하지만, API는 두 타입 모두 지원합니다.

### Q4. 메모는 누가 볼 수 있나요?

운영자(관리자) 역할을 가진 사용자만 메모를 조회/작성할 수 있습니다.
본인이 작성한 메모만 수정/삭제할 수 있습니다.

---

## 📞 문의

추가 개선사항이나 버그가 있으면 알려주세요!

**주요 파일 위치**:
- 마이그레이션: `migrations/17_quote_inquiry_enhancement.sql`
- 메인 UI: `app/admin/quote-inquiries/page.tsx`
- 메모 API: `lib/api/inquiryNotes.ts`
- 타입 정의: `types/index.ts`

---

## ✅ 체크리스트

배포 전 확인사항:

- [ ] 마이그레이션 파일 검토
- [ ] 테스트 환경에서 테스트
- [ ] 백업 완료
- [ ] 마이그레이션 실행
- [ ] 프론트엔드 배포
- [ ] 기능 테스트
- [ ] 운영자 교육

배포 완료! 🎉

