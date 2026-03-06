## UX/DB/Query 표준화 계획

### 1) Toast 알림 시스템 표준화
- 기본 원칙
  - `alert()` 사용 금지, `@/lib/toast`의 `showSuccess`, `showError` 사용
  - 사용자 액션 성공/실패를 토스트로 즉시 피드백
  - 차단형 확인은 `window.confirm` 유지(삭제/파괴 액션)
- 이번 반영 범위
  - `app/(admin)/inbound/new/page.tsx`
  - `app/(admin)/inbound/[id]/edit/page.tsx`
  - `app/(admin)/inbound/page.tsx`
  - `components/ExcelUpload.tsx`
- 후속 반영 권장
  - `alert()` 금지 ESLint 룰 추가 (`no-alert`)
  - ESLint 룰 또는 CI grep 검사로 `alert(` 신규 유입 차단
  - 서버 에러는 상태코드 기반 표준 메시지 사용

### 1-1) 상태코드별 토스트 정책
- 공통 유틸
  - `lib/httpToast.ts` 추가
  - `toastHttpError(response, fallback)`를 통해 에러 바디 + 상태코드 메시지 표준화
- 상태코드 매핑
  - `400` 요청값 오류 / `401` 로그인 필요 / `403` 권한 없음
  - `404` 데이터 없음 / `409` 충돌 / `413` 용량 초과 / `422` 검증 실패
  - `429` 요청 과다 / `5xx` 서버 오류
- 적용 파일(핵심)
  - `app/(admin)/admin/quote-inquiries/page.tsx`
  - `app/(admin)/orders/tabs/ImportTab.tsx`
  - `app/(admin)/cs/tabs/TemplatesTab.tsx`
  - `app/(admin)/admin/orders/[id]/page.tsx`

### 2) DB FK 인덱스 점검
- 점검 대상
  - 요청 테이블명: `order_items`, `inbound_lines`
  - 현재 스키마 대응: `outbound_order_line`, `inbound_receipt_lines`
- 전략
  - 테이블 존재 여부 확인 후 인덱스 생성 (`to_regclass`)
  - 이미 유효한 선두 컬럼 인덱스가 있으면 생성 스킵
  - 마이그레이션으로 재실행 가능하도록 idempotent 구성
- 적용 파일
  - `supabase/migrations/20260305113000_audit_fk_indexes_for_order_items_and_inbound_lines.sql`

### 3) React Query 키 관리 표준화
- 원칙
  - 문자열 하드코딩 키 금지
  - `lib/queryKeys.ts`의 팩토리 함수/상수만 사용
  - invalidate 시에도 동일 팩토리 키 사용
- 이번 반영 범위
  - `app/(admin)/inventory/page.tsx`
  - `app/(admin)/management/documents/page.tsx`
- 확장 권장
  - 도메인별 키 네임스페이스 확장 (예: `inbound`, `orders`, `cs`)
  - API 레이어 단에서 query option factory(`queryOptions`)까지 일원화

### 3-1) 키 팩토리 확장 반영
- `lib/queryKeys.ts` 확장
  - `inbound.*`
  - `orders.*`
  - `cs.*`
- 가이드
  - 신규 `useQuery`/`invalidateQueries` 작성 시 문자열 배열 직접 사용 금지
  - 필터 객체는 key factory의 `params`로 캡슐화

