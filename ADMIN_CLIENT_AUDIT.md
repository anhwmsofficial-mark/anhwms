# Admin Client Audit Logging

Service Role Client (`createAdminClient`) 사용을 추적하고, 불필요한 사용을 줄여나가기 위해 감사 로그를 도입했습니다.

## 1. 개요

`createAdminClient`를 직접 호출하는 대신, `createTrackedAdminClient` 래퍼 함수를 사용하여 호출 정보를 로깅합니다.

*   **Console Log**: `[ADMIN_CLIENT_USED]` 태그와 함께 호출 정보 출력.
*   **DB Log**: `audit_logs` 테이블에 `action_type: 'ADMIN_CLIENT_ACCESS'`로 기록.

## 2. 구현 내용

### `utils/supabase/admin-client.ts`

*   `createTrackedAdminClient` 함수 제공 (alias: `createAdminClient`).
*   호출 스택(Stack Trace)을 파싱하여 호출자 파일(`caller`)을 자동 식별.
*   `route`, `action`, `requestId` 등의 컨텍스트 정보를 인자로 받음.
*   DB 로깅은 메인 로직에 영향을 주지 않도록 `void` (Fire-and-forget) 처리.

### 로그 예시

```json
{
  "action_type": "ADMIN_CLIENT_ACCESS",
  "resource_type": "SYSTEM",
  "resource_id": "req_12345",
  "new_value": {
    "route": "share_inventory_internal",
    "action": "load_rows",
    "caller": "app/api/share/inventory/route.ts:65:20",
    "timestamp": "2024-03-07T10:00:00Z"
  },
  "reason": "Service Role Client Used"
}
```

## 3. 적용된 파일 목록

다음 파일들에서 `createAdminClient` 호출이 `createTrackedAdminClient`로 변경되었습니다.

*   `app/actions/inbound.ts`
    *   `confirmReceipt`
    *   `getOpsInboundData`
    *   `saveInboundPhoto` (기존 적용)
    *   `saveReceiptLines` (기존 적용)
*   `app/api/share/inventory/route.ts`
    *   `loadRowsByShare`
    *   `GET` handler
    *   `POST` handler

## 4. 사용 방법

```typescript
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';

// 사용 시 가능한 컨텍스트 정보를 제공하세요.
const db = createTrackedAdminClient({
  route: 'API_ROUTE_NAME',
  action: 'ACTION_NAME',
  requestId: 'REQ_ID'
});
```

## 5. 향후 계획

1.  **로그 분석**: `audit_logs`에 쌓인 데이터를 분석하여 불필요한 Admin Client 사용 패턴 식별.
2.  **RLS 전환**: 식별된 경로를 User Client + RLS 또는 `security definer` RPC로 전환.
3.  **알림**: Admin Client 사용 빈도가 높은 경로는 경고 알림 설정 고려.
