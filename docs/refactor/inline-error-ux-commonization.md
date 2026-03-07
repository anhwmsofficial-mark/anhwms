# 인라인 에러 UX 공통화 (1차 완료)

## 개요

관리자/CS 화면의 에러 표시를 `InlineErrorAlert` 기반으로 통일하고, `requestId` 복사 UX를 인라인 피드백으로 개선했다.

---

## 1. 수동 확인 포인트 (이번 전환 3개 화면)

### app/(admin)/admin/warehouses/page.tsx

| 확인 항목 | 방법 |
|-----------|------|
| 창고 목록 로드 실패 | 권한 제거 또는 API 오류 시뮬레이션 → 인라인 에러 박스 표시 확인 |
| 창고 등록/수정 실패 | 필수값 누락 또는 서버 오류 → 인라인 에러 박스 표시 확인 |
| 레이아웃 | 에러 박스가 통계 카드/필터 영역과 겹치지 않는지 확인 |

### app/(admin)/inbound/page.tsx

| 확인 항목 | 방법 |
|-----------|------|
| 입고 목록 로드 실패 | Supabase/액션 오류 시뮬레이션 → 인라인 에러 박스 표시 확인 |
| 삭제/완료 처리 실패 | `deleteInboundPlan`, `confirmReceipt` 오류 시 → 인라인 + 토스트 동시 표시 확인 |
| 토스트와 문구 일치 | 인라인 메시지와 토스트 메시지가 동일한지 확인 |

### app/(admin)/admin/audit-logs/page.tsx

| 확인 항목 | 방법 |
|-----------|------|
| 감사 로그 조회 실패 | 401/403/500 시뮬레이션 → 인라인 에러 박스 표시 확인 |
| requestId 복사 | API 오류 시 "요청 ID" + [복사] 버튼 노출 → 클릭 시 "복사됨" 2초 표시 후 복귀 확인 |
| 필터 변경 후 재조회 | 필터 변경 시 에러 상태 초기화 및 재조회 정상 동작 확인 |

---

## 2. InlineErrorAlert 사용 가이드

### requestId 복사 UX

- 복사 성공 시 **토스트 없음** (showSuccess 호출하지 않음)
- 버튼 텍스트만 `복사` → `복사됨`으로 2초간 표시 후 복귀
- 인라인 피드백으로 조용하고 일관된 UX 유지

### 기본 사용

```tsx
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import { getInlineErrorMeta, normalizeInlineError, toClientApiError, type InlineErrorMeta } from '@/lib/api/client';

// 상태: InlineErrorMeta | null
const [error, setError] = useState<InlineErrorMeta | null>(null);

// API fetch 실패 시
if (!res.ok) {
  const payload = await res.json().catch(() => null);
  setError(getInlineErrorMeta(toClientApiError(res.status, payload, fallback), fallback));
  return;
}

// catch 블록 (예외/네트워크 오류)
catch (err: unknown) {
  setError(normalizeInlineError(err, '기본 메시지'));
}

// 렌더
<InlineErrorAlert error={error} className="..." />
```

### 입력 타입

- `InlineErrorMeta | string | null | undefined`
- `string`: `{ message }` 로 변환
- `InlineErrorMeta`: `{ message, requestId? }` — `requestId` 있으면 복사 버튼 노출 (API Route 응답에만 포함, 서버 액션은 미포함)

### 공통 헬퍼

| 헬퍼 | 용도 |
|------|------|
| `toClientApiError(status, payload, fallback)` | API 응답 → `ClientApiError` |
| `getInlineErrorMeta(apiError, fallback)` | `ClientApiError` → `InlineErrorMeta` |
| `normalizeInlineError(err, fallback)` | `Error`/`string`/기타 → `InlineErrorMeta` |

---

## 3. 후속 과제: requestId 미노출 화면

**원인:** `requestId`가 안 보이는 화면은 "프론트 미전환"이 아니라 **서버 액션 또는 직접 호출 경로**를 사용하기 때문이다.

| 화면 | 호출 경로 | requestId |
|------|-----------|-----------|
| admin/warehouses | `listWarehousesAction`, `createWarehouseAction`, `updateWarehouseAction` | ❌ |
| inbound | `getInboundStats`, `deleteInboundPlan`, `confirmReceipt` + Supabase 직접 | ❌ |
| users | `listUsersAction`, `createUserAction`, `updateUserAction`, `deleteUserAction` | ❌ |
| admin/orders/[id] | `getOrder` (lib) | ❌ |
| admin/audit-logs | `fetch('/api/admin/audit-logs')` | ✅ |

**후속 검토 사항 (선택):**

- 서버 액션에서 `requestId`를 반환하도록 확장
- 또는 해당 화면은 `requestId` 없이 메시지만 표시 (현재 동작 유지)

---

## 4. 추천 커밋 메시지

```
feat(admin): 인라인 에러 UX 공통화 및 requestId 복사 개선

- InlineErrorAlert: 복사 성공 시 토스트 제거, 인라인 "복사됨" 피드백으로 변경
- warehouses, inbound, audit-logs 3개 화면 InlineErrorAlert 전환
- toClientApiError/getInlineErrorMeta/normalizeInlineError 흐름 재사용
- 비즈니스 로직 변경 없음, 에러 표시층만 정리
```

---

## 5. PR 요약문 초안

### 제목

`[Admin] 인라인 에러 UX 공통화 및 requestId 복사 UX 개선`

### 본문

**목표**
- 관리자 화면 에러 표시를 `InlineErrorAlert` 기반으로 통일
- `requestId` 복사 피드백을 토스트에서 인라인 방식으로 변경

**변경 사항**
- `InlineErrorAlert`: 복사 성공 시 `showSuccess` 토스트 제거, 버튼 "복사됨" 2초 표시
- `admin/warehouses`, `inbound`, `admin/audit-logs` 3개 화면 InlineErrorAlert 전환
- 공통 헬퍼(`toClientApiError`, `getInlineErrorMeta`, `normalizeInlineError`) 재사용

**미변경**
- 비즈니스 로직, 서버 액션 구조, 데이터 로드/저장 흐름

**후속**
- 서버 액션 사용 화면(warehouses, inbound, users 등)은 `requestId` 미노출 — 별도 검토 필요
