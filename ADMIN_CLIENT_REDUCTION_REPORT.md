# Admin Client Reduction Report

운영 안정성을 높이고 보안을 강화하기 위해 `createAdminClient` 및 `supabaseAdmin` 사용을 점진적으로 축소하는 작업의 결과 보고서입니다.

## 1. 개요

*   **목표**: RLS 우회(Service Role) 구간 최소화 및 테넌트 격리 강화.
*   **전략**:
    *   **Class A (즉시 전환)**: `ensurePermission`으로 보호되는 Server Action을 User Client로 전환.
    *   **Class B (보강 후 전환)**: `requireAdminRouteContext` 등 시스템 전반에 걸친 로직은 유지하되 안정성 강화.
    *   **Class C (유지)**: Cron, Public Share 등 사용자 세션이 없는 구간은 Service Role 유지.

## 2. 작업 결과 (Class A 전환 완료)

다음 파일들은 Service Role Client(`supabaseAdmin`)에서 User Client(`createClient`)로 전환되어 **RLS 정책의 보호**를 받게 되었습니다.

1.  `app/actions/admin/customers.ts` (고객사 관리)
2.  `app/actions/admin/brands.ts` (브랜드 관리)
3.  `app/actions/admin/warehouses.ts` (창고 관리)

> **효과**: 관리자라도 본인 조직(Org)의 데이터만 접근 가능하도록 DB 레벨에서 강제됨.

## 3. 잔여 사용처 및 향후 계획

### Class B: 보강 후 전환 대상 (Medium Risk)

| 경로 | 설명 | 권장 조치 |
| :--- | :--- | :--- |
| `app/actions/admin/users.ts` | 사용자 생성/삭제 | `auth.admin`은 유지하되, DB 조회 로직은 User Client로 분리 검토. |
| `lib/server/admin-ownership.ts` | 권한/소유권 검증 | `requireAdminRouteContext`가 반환하는 Client를 점진적으로 User Client로 대체. |
| `app/api/admin/products/bulk/route.ts` | 대량 업로드 | 대량 Insert 성능 및 RLS 오버헤드 검토 후 전환. |

### Class C: 유지 대상 (Low Risk / Necessary)

| 경로 | 설명 | 사유 |
| :--- | :--- | :--- |
| `app/api/cron/*` | 스케줄링 작업 | 사용자 세션 없음 (System Actor). |
| `app/api/share/*` | 공유 링크 | 비로그인 접근 허용 필요. |
| `scripts/*` | 관리 스크립트 | CLI 실행 환경. |

## 4. 검증 체크리스트 (Regression Test)

배포 전 다음 기능을 반드시 수동 검증해야 합니다.

- [ ] **고객사 관리**: 목록 조회, 생성, 수정, 비활성화가 정상 동작하는가?
- [ ] **브랜드 관리**: 목록 조회 및 상세 정보 확인이 가능한가?
- [ ] **창고 관리**: 창고 생성 및 수정이 권한 오류 없이 동작하는가?
- [ ] **권한 테스트**: 타 조직 관리자로 로그인 시 위 데이터가 보이지 않아야 함.

## 5. 결론

핵심 Admin Action 3종을 안전하게 RLS 기반으로 전환했습니다. 남은 `createTrackedAdminClient` 사용처는 `audit_logs`를 통해 지속적으로 모니터링하며, 다음 Phase에서 `users` 관리 로직 분리 및 Bulk API 최적화를 진행할 것을 권장합니다.
