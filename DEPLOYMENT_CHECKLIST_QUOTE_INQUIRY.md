# 견적 문의 시스템 배포 체크리스트

## 🚀 배포 순서

### 1단계: 백업 (필수)

```bash
# Supabase Dashboard에서 데이터베이스 백업 생성
# Settings → Database → Create Backup
```

- [ ] 데이터베이스 백업 완료
- [ ] 백업 파일 다운로드 및 안전한 위치에 저장

---

### 2단계: 마이그레이션 실행

Supabase SQL Editor에서 다음 파일 실행:

```sql
-- migrations/17_quote_inquiry_enhancement.sql
```

**실행 순서**:
1. Supabase Dashboard → SQL Editor
2. `migrations/17_quote_inquiry_enhancement.sql` 파일 내용 복사
3. 붙여넣기 후 실행
4. 성공 메시지 확인: "견적 문의 기능 확장 완료"

- [ ] 마이그레이션 실행 완료
- [ ] 에러 없음 확인
- [ ] 테이블 생성 확인 (`inquiry_notes`)
- [ ] 컬럼 추가 확인 (`assigned_to`, `quote_file_url`, `quote_sent_at`, `updated_at`)

---

### 3단계: 코드 배포

#### Vercel (자동 배포)

```bash
# Git push하면 자동으로 배포됩니다
git add .
git commit -m "feat: 견적 문의 관리 시스템 업그레이드"
git push origin main
```

- [ ] Git push 완료
- [ ] Vercel 배포 시작 확인
- [ ] 배포 완료 확인 (Vercel Dashboard)
- [ ] 빌드 에러 없음 확인

---

### 4단계: 배포 후 테스트

#### 4-1. 기본 기능 테스트

- [ ] https://www.anhwms.com/admin/quote-inquiries 접속
- [ ] 기존 견적 문의 목록이 정상적으로 보이는지 확인
- [ ] 새로고침 버튼 동작 확인

#### 4-2. 통계 카드 테스트

- [ ] 8개 상태별 카운트가 정확한지 확인
- [ ] 카드 클릭 시 필터링 동작 확인

#### 4-3. 필터링 테스트

- [ ] 검색 기능 (회사명, 담당자, 이메일) 테스트
- [ ] 상태 필터 드롭다운 테스트
- [ ] 담당자 필터 드롭다운 테스트
- [ ] 날짜 범위 필터 테스트
- [ ] 필터 초기화 버튼 테스트

#### 4-4. 상세 패널 테스트

- [ ] 문의 건 클릭 시 오른쪽 패널 열림 확인
- [ ] 슬라이드 애니메이션 정상 동작 확인
- [ ] X 버튼으로 닫기 동작 확인
- [ ] 배경 클릭으로 닫기 동작 확인

#### 4-5. 상태 변경 테스트

- [ ] 워크플로우 버튼으로 상태 변경
- [ ] 현재 상태는 비활성화되어 있는지 확인
- [ ] 상태 변경 후 목록에 즉시 반영되는지 확인
- [ ] 통계 카드 숫자가 업데이트되는지 확인

#### 4-6. 담당자 지정 테스트

- [ ] 담당자 드롭다운이 정상적으로 로드되는지 확인
- [ ] 담당자 지정 동작 확인
- [ ] 담당자 변경 동작 확인
- [ ] "담당자 미배정" 선택 동작 확인

#### 4-7. 메모 기능 테스트

- [ ] 메모 입력 필드가 보이는지 확인
- [ ] 메모 추가 버튼 동작 확인
- [ ] 추가한 메모가 즉시 목록에 표시되는지 확인
- [ ] 메모 삭제 버튼 동작 확인
- [ ] 작성자 이름이 정확히 표시되는지 확인
- [ ] 작성 시간이 정확히 표시되는지 확인

#### 4-8. 견적서 업로드 테스트

- [ ] 파일 업로드 버튼이 보이는지 확인
- [ ] PDF 파일 선택 시 업로드 동작 확인
- [ ] 업로드 후 상태가 "견적 발송"으로 변경되는지 확인
- [ ] 업로드한 파일 정보가 표시되는지 확인
- [ ] 다운로드 링크가 동작하는지 확인

---

### 5단계: 데이터 무결성 확인

Supabase SQL Editor에서 다음 쿼리 실행:

```sql
-- 1. 상태 값이 올바르게 변환되었는지 확인
SELECT status, COUNT(*) 
FROM external_quote_inquiry 
GROUP BY status;

-- 2. 새 컬럼이 정상적으로 추가되었는지 확인
SELECT 
  id, 
  company_name, 
  status, 
  assigned_to, 
  quote_file_url, 
  quote_sent_at, 
  updated_at 
FROM external_quote_inquiry 
LIMIT 5;

-- 3. inquiry_notes 테이블이 생성되었는지 확인
SELECT COUNT(*) FROM inquiry_notes;
```

- [ ] 상태 값에 `in_progress`, `closed_won`, `closed_lost`가 없는지 확인
- [ ] 새 컬럼들이 정상적으로 조회되는지 확인
- [ ] `inquiry_notes` 테이블이 존재하는지 확인

---

### 6단계: 롤백 계획 (문제 발생 시)

#### 6-1. 데이터베이스 롤백

```sql
-- 새로 추가된 컬럼 삭제
ALTER TABLE external_quote_inquiry 
DROP COLUMN IF EXISTS assigned_to,
DROP COLUMN IF EXISTS quote_file_url,
DROP COLUMN IF EXISTS quote_sent_at,
DROP COLUMN IF EXISTS updated_at;

-- 테이블 삭제
DROP TABLE IF EXISTS inquiry_notes;

-- 상태 제약 조건 원복
ALTER TABLE external_quote_inquiry DROP CONSTRAINT external_quote_inquiry_status_check;
ALTER TABLE external_quote_inquiry
ADD CONSTRAINT external_quote_inquiry_status_check CHECK (
  status IN ('new', 'in_progress', 'quoted', 'closed_won', 'closed_lost')
);

-- 상태 값 원복
UPDATE external_quote_inquiry SET status = 'in_progress' WHERE status = 'processing';
UPDATE external_quote_inquiry SET status = 'closed_won' WHERE status = 'won';
UPDATE external_quote_inquiry SET status = 'closed_lost' WHERE status = 'lost';
```

#### 6-2. 코드 롤백

```bash
# 이전 버전으로 되돌리기
git revert HEAD
git push origin main
```

---

### 7단계: 운영자 교육

- [ ] 새로운 UI 안내
- [ ] 워크플로우 프로세스 교육
- [ ] 메모 작성 가이드라인 공유
- [ ] 담당자 지정 규칙 공유
- [ ] FAQ 문서 공유

---

## 📊 예상 소요 시간

| 단계 | 예상 시간 |
|------|-----------|
| 1. 백업 | 5분 |
| 2. 마이그레이션 | 2분 |
| 3. 코드 배포 | 5분 |
| 4. 테스트 | 15분 |
| 5. 데이터 확인 | 5분 |
| 6. 운영자 교육 | 30분 |
| **총계** | **약 1시간** |

---

## 🆘 문제 발생 시 연락처

**긴급 이슈**: [개발팀 연락처]

**일반 문의**: [운영팀 연락처]

---

## ✅ 최종 확인

배포 완료 후 체크:

- [ ] 모든 기능이 정상 동작합니다
- [ ] 기존 데이터가 손실되지 않았습니다
- [ ] 운영자가 새 기능을 이해했습니다
- [ ] 문서가 업데이트되었습니다

**배포 완료 일시**: ________________

**배포 담당자**: ________________

**승인자**: ________________

---

## 📚 관련 문서

- [상세 업그레이드 가이드](./QUOTE_INQUIRY_UPGRADE_GUIDE.md)
- [마이그레이션 파일](./migrations/17_quote_inquiry_enhancement.sql)
- [메인 UI 코드](./app/admin/quote-inquiries/page.tsx)

배포 성공을 기원합니다! 🚀

