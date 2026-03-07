# Legacy Admin Client (`supabaseAdmin`) 사용처 분석

> **작성일**: 2026년 3월 7일  
> **분석 목적**: Service Role Key 의존성 제거 및 RLS 준수 전환을 위한 현황 파악

---

## 1. 개요
현재 코드베이스에는 `supabaseAdmin` (또는 `createAdminClient`)을 사용하여 RLS(Row Level Security)를 우회하는 코드가 다수 존재합니다. 이는 개발 편의성을 높였으나, **권한 체크 누락 시 보안 사고**로 이어질 위험이 있습니다.

- **총 발견 파일 수**: 약 25개
- **주요 사용 패턴**: Admin Action, Batch Job, 공유(Public) API

---

## 2. 사용처 상세 목록 및 우선순위

### Group A: 즉시 전환 가능 (위험도: 낮음)
*RLS 정책이 이미 설정되어 있어, 사용자 세션(`createClient`)으로 바꿔도 정상 동작하는 구간.*

| 파일 경로 | 사용 목적 | 조치 방안 |
|---|---|---|
| `app/api/products/search/route.ts` | 상품 검색 | 공개 검색이면 `createClient` (Anon) 또는 로그인 유저 세션 사용. |
| `app/actions/admin/locations.ts` | 로케이션 조회 | 이미 `ensurePermission` 체크 중이나, RLS로 이중 방어 가능. |
| `app/actions/admin/brands.ts` | 브랜드 조회 | 상동. |
| `app/actions/admin/warehouses.ts` | 창고 조회 | 상동. |

### Group B: 보호장치 보강 후 전환 (위험도: 중간)
*복잡한 쿼리나 조인이 있어 RLS 정책만으로는 성능/기능 이슈가 있을 수 있거나, 권한 체크가 로직 내부에 깊숙이 박힌 경우.*

| 파일 경로 | 사용 목적 | 조치 방안 |
|---|---|---|
| `app/actions/admin/products.ts` | 상품 생성/수정 | `resolveCustomerCode` 등 내부 유틸리티도 Admin 의존성 있음. 유틸리티부터 리팩토링 필요. |
| `app/actions/admin/customers.ts` | 고객사 관리 | `audit_logs` 기록 등 시스템 권한 필요 작업이 섞여 있음. 트랜잭션 분리 필요. |
| `app/api/inbound/[id]/inspect/route.ts` | 입고 검수 | 현재 `createClient` 사용으로 전환 완료됨 (모범 사례). |

### Group C: 당분간 유지 필요 (위험도: 높음 -> 관리 필요)
*배치 작업, 공개 링크, 시스템 관리 등 Service Role이 필수적인 구간.*

| 파일 경로 | 사용 목적 | 사유 |
|---|---|---|
| `app/api/share/inventory/route.ts` | 재고 공유 (Public) | 로그인하지 않은 외부 사용자에게 데이터를 보여주기 위해 필수. |
| `app/api/cron/*` | 크론 작업 (Alerts, Audit) | 백그라운드 작업이므로 사용자 세션이 없음. |
| `app/actions/admin/users.ts` | 사용자 관리 | `auth.admin` API 사용 (사용자 생성/삭제)은 Service Role 필수. |
| `scripts/*.js` | 유지보수 스크립트 | CLI 실행용이므로 유지. |

---

## 3. 권장 로드맵

1.  **Phase 3 (단기)**: **Group A** 대상을 `createClient` (Server Component Client)로 교체하여 불필요한 Admin 권한 사용 축소.
2.  **Phase 4 (중기)**: **Group B**의 비즈니스 로직을 "사용자 액션"과 "시스템 액션"으로 분리. 사용자 액션은 RLS 클라이언트로 수행.
3.  **Ongoing**: `ensurePermission` 함수가 모든 Admin Action의 최상단에 있는지 CI/CD 파이프라인이나 린트 룰로 강제.

---
