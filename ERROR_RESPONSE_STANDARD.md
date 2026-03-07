# 에러 응답 표준화 가이드 (Error Response Standard)

## 1. 개요

ANH WMS의 모든 API(Route Handler, Server Action)는 일관된 에러 응답 구조를 반환해야 합니다. 이를 통해 프론트엔드에서 예측 가능한 에러 처리가 가능해집니다.

## 2. 에러 응답 구조

### 2.1. API Route (JSON)

```json
{
  "ok": false,
  "error": "사용자에게 표시할 메시지",
  "message": "사용자에게 표시할 메시지 (legacy 호환)",
  "code": "ERROR_CODE_STRING",
  "status": 400,
  "details": { ... } // 선택적 상세 정보
}
```

### 2.2. Server Action (Return Value)

```typescript
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string; status: number; details?: unknown };
```

## 3. 표준 에러 코드 (ERROR_CODES)

`lib/api/errors.ts`에 정의된 `ERROR_CODES` 상수를 사용합니다.

| 코드 | HTTP 상태 | 설명 |
| :--- | :--- | :--- |
| `BAD_REQUEST` | 400 | 잘못된 요청 파라미터 |
| `UNAUTHORIZED` | 401 | 로그인 필요 |
| `FORBIDDEN` | 403 | 권한 없음 (롤, 테넌트 불일치) |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `CONFLICT` | 409 | 중복 데이터, 상태 충돌 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |
| `VALIDATION_ERROR` | 422 | 유효성 검사 실패 |
| `STOCK_SHORTAGE` | 400 | 재고 부족 |
| `INVALID_FILE` | 400 | 지원하지 않는 파일 형식 |
| `FILE_TOO_LARGE` | 400 | 파일 용량 초과 |
| `ROW_LIMIT_EXCEEDED`| 400 | 처리 가능한 행 개수 초과 |
| `TENANT_MISMATCH` | 403 | 다른 테넌트 데이터 접근 시도 |

## 4. 구현 가이드

### 4.1. API Route Handler

`fail` 함수와 `ERROR_CODES`를 사용합니다.

```typescript
import { fail, ok } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function POST(req: Request) {
  try {
    // ... logic
    if (!valid) {
      return fail(ERROR_CODES.BAD_REQUEST, '잘못된 요청입니다.', { status: 400 });
    }
    return ok({ success: true });
  } catch (e) {
    return fail(ERROR_CODES.INTERNAL_ERROR, '서버 오류', { status: 500 });
  }
}
```

### 4.2. Server Action

`actionError` 또는 `failFromError` 헬퍼를 사용합니다.

```typescript
import { actionError } from '@/lib/actions/result'; // 또는 로컬 헬퍼
import { ERROR_CODES } from '@/lib/api/errors';

export async function myAction() {
  try {
    // ...
  } catch (e) {
    return actionError(ERROR_CODES.INTERNAL_ERROR, '작업 실패');
  }
}
```

### 4.3. Service Layer

`AppApiError`를 throw하거나, 일반 Error를 throw하고 상위에서 잡습니다.

```typescript
import { AppApiError, ERROR_CODES } from '@/lib/api/errors';

export async function myService() {
  if (!found) {
    throw new AppApiError({
      code: ERROR_CODES.NOT_FOUND,
      error: '데이터가 없습니다.',
      status: 404
    });
  }
}
```
