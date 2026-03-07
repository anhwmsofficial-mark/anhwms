# Legacy Admin Client (`supabaseAdmin`) 사용처 분석

현재 코드베이스에는 `supabaseAdmin` (또는 `createAdminClient`)을 사용하여 RLS(Row Level Security)를 우회하는 코드가 다수 존재합니다. 이는 개발 편의성을 높였으나, **권한 체크 누락 시 보안 사고**로 이어질 위험이 있습니다.

## 1. 위험도 분류 기준

*   **HIGH (즉시 조치 필요)**: 사용자 입력을 직접 받아 처리하거나, 민감한 데이터(개인정보, 결제 등)를 다루는 경로. RLS로 충분히 대체 가능함에도 습관적으로 사용된 경우.
*   **MEDIUM (점진적 개선)**: 관리자 전용 기능이거나, 복잡한 조인/집계가 필요하여 RLS만으로는 성능 이슈가 예상되는 경우.
*   **LOW (유지 가능)**: 백그라운드 작업(Cron), 시스템 초기화(Seed), 또는 RLS로 해결 불가능한 특수 로직(예: 회원가입 시 중복 체크, 비밀번호 재설정 등).

## 2. 사용처 목록 및 조치 계획

### A. HIGH Risk (우선 전환 대상)

| 파일 경로 | 사용 목적 | 현재 보호장치 | 권장 조치 |
| :--- | :--- | :--- | :--- |
| `app/actions/admin/customers.ts` | 고객사 CRUD | `ensurePermission` | `createClient` (Server Action) + RLS로 전환 |
| `app/actions/admin/products.ts` | 상품 CRUD | `ensurePermission` | `createClient` + RLS로 전환 |
| `app/actions/admin/users.ts` | 사용자 관리 | `ensurePermission` | `supabase.auth.admin`은 유지하되, DB 조회는 RLS로 전환 |
| `app/api/admin/customers/route.ts` | 고객사 목록 조회 | `listCustomersAction` 위임 | Action 전환 시 자동 해결 |

### B. MEDIUM Risk (보호장치 보강 후 전환)

| 파일 경로 | 사용 목적 | 현재 보호장치 | 권장 조치 |
| :--- | :--- | :--- | :--- |
| `app/api/admin/inventory/stats/route.ts` | 재고 통계 | 없음 (추정) | `requireAdminRouteContext` 적용 후 `tenant_id` 필터 강제 |
| `app/api/admin/audit-logs/route.ts` | 감사 로그 조회 | `requirePermission` | `requireAdminRouteContext` 적용하여 tenant 격리 강화 |
| `lib/server/admin-ownership.ts` | 소유권 검증 | 내부 로직 | `createAdminClient` 대신 `createClient` 사용 가능 여부 검토 |

### C. LOW Risk (당분간 유지)

| 파일 경로 | 사용 목적 | 이유 |
| :--- | :--- | :--- |
| `app/api/cron/*` | 스케줄링 작업 | 사용자 세션이 없는 백그라운드 실행이므로 Admin Client 필수 |
| `app/api/share/*` | 외부 공유 링크 | 로그인하지 않은 사용자에게 제한된 데이터 노출 필요 |
| `scripts/*.ts` | 데이터 시딩/마이그레이션 | 로컬/CI 환경에서 실행되는 관리 스크립트 |
| `app/(auth)/login/actions.ts` | 로그인/회원가입 | `auth.admin` 기능 필요 (이메일 중복 체크 등) |

## 3. 전환 가이드

1.  **Server Action / Route Handler**:
    ```typescript
    // Before
    import { supabaseAdmin } from '@/lib/supabase-admin';
    const { data } = await supabaseAdmin.from('table').select('*');

    // After
    import { createClient } from '@/utils/supabase/server';
    const supabase = await createClient();
    const { data } = await supabase.from('table').select('*');
    ```

2.  **Admin 전용 기능 (RLS 우회 필요 시)**:
    *   `requireAdminRouteContext`를 사용하여 `orgId`를 확보하고, 쿼리에 `.eq('tenant_id', orgId)`를 반드시 포함한다.

3.  **Cron / Background**:
    *   `createAdminClient()` 사용을 유지하되, 로직 내에서 대상 `tenant_id`를 명확히 식별하고 순회하도록 작성한다.
