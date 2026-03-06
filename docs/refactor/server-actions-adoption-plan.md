# Server Actions 전면 도입 계획

## 목표
- 단순 CRUD 성격의 `app/api/**/route.ts`를 Server Actions로 이관해 중복 로직을 줄인다.
- 권한검사, 에러 포맷, 캐시 무효화(`revalidatePath`)를 액션 계층에 모아 유지보수 비용을 낮춘다.
- 기존 API Route는 단계적으로 "호환 레이어"로 축소하고, 최종적으로 내부 호출 경로에서 제거한다.

## 전환 기준
- 전환 우선: 내부 UI에서만 사용하는 단순 CRUD 엔드포인트
- 유지 우선: 외부 시스템 연동, 웹훅/크론, 파일 업로드, 스트리밍/대용량 처리
- 혼합 운영: 초기에는 API Route를 유지하되 내부 구현을 Action에 위임

## 이번 배포(1차) 적용 범위
- 도메인: `customers`
- 신규 Action: `app/actions/admin/customers.ts`
  - `listCustomersAction`
  - `getCustomerByIdAction`
  - `createCustomerAction`
  - `updateCustomerAction`
  - `deactivateCustomerAction`
- 전환된 호출부
  - `app/(admin)/admin/customers/page.tsx` 목록 조회
  - `app/(admin)/admin/customers/[id]/page.tsx` 상세 조회
  - `src/features/inbound/new/api/fetchMeta.ts` 활성 고객사 조회
- 호환 유지
  - `app/api/admin/customers/route.ts`
  - `app/api/admin/customers/[id]/route.ts`
  - 위 두 Route는 이제 Action을 호출하는 thin wrapper 역할

## 이번 배포(2차) 적용 범위
- 도메인: `products` CRUD
- 신규 Action: `app/actions/admin/products.ts`
  - `listProductsAction`
  - `createProductAction`
  - `updateProductAction`
  - `deleteProductAction`
- 호환 유지
  - `app/api/admin/products/route.ts`
  - 위 Route는 이제 Action 위임용 thin wrapper 역할
- 연계 개선
  - `src/features/inbound/new/api/createProduct.ts`를 Action 호출로 전환
  - 엑셀 기반 자동생성 시 고객사 ID를 명시 전달하도록 보정

## 이번 배포(3차) 적용 범위
- 도메인: `users` 단순 CRUD/관리 액션
- 신규 Action: `app/actions/admin/users.ts`
  - `listUsersAction`
  - `createUserAction`
  - `updateUserAction`
  - `deleteUserAction`
  - `userMutationAction`(restore/unlock)
  - `listManagerUsersAction`
- 호환 유지
  - `app/api/admin/users/route.ts`
  - `app/api/admin/users/[id]/route.ts`
  - `app/api/admin/users/managers/route.ts`
  - 위 Route들은 Action 위임용 thin wrapper 역할
- 호출부 전환
  - `app/(admin)/users/page.tsx`의 사용자 목록/생성/수정/삭제 호출을 Action 직접 호출로 전환
  - `src/features/inbound/new/api/fetchMeta.ts`의 매니저 조회를 Action 호출로 전환

## 이번 배포(4차) 적용 범위
- 도메인: `brands`, `categories`, `warehouses`, `locations`
- 신규 Action
  - `app/actions/admin/brands.ts`
  - `app/actions/admin/categories.ts`
  - `app/actions/admin/warehouses.ts`
  - `app/actions/admin/locations.ts`
- 호환 유지(Route thin wrapper)
  - `app/api/admin/brands/route.ts`
  - `app/api/admin/brands/[id]/route.ts`
  - `app/api/admin/categories/route.ts`
  - `app/api/admin/warehouses/route.ts`
  - `app/api/admin/warehouses/[id]/route.ts`
  - `app/api/admin/locations/route.ts`
  - `app/api/admin/locations/[id]/route.ts`
- 호출부 전환
  - `app/(admin)/admin/warehouses/page.tsx`
  - `app/(admin)/admin/locations/page.tsx`
  - `lib/api/products.ts`의 카테고리 조회

## 이번 배포(5차) 적용 범위
- 공통 Action 결과 타입/에러 처리 유틸 도입
  - `lib/actions/result.ts`
  - `ActionResult<T>` 타입 단일화
  - `failFromError`, `isUnauthorizedError` 공통 사용
- 적용 대상
  - `app/actions/admin/customers.ts`
  - `app/actions/admin/products.ts`
  - `app/actions/admin/users.ts`
  - `app/actions/admin/brands.ts`
  - `app/actions/admin/categories.ts`
  - `app/actions/admin/warehouses.ts`
  - `app/actions/admin/locations.ts`

## 이번 배포(6차) 적용 범위
- 권한 체크 공통 모듈 도입
  - `lib/actions/auth.ts`
  - `ensurePermission(permission, request?)`
  - `ensureAdminUserAccess()`
- 적용 대상
  - `app/actions/admin/customers.ts`
  - `app/actions/admin/products.ts`
  - `app/actions/admin/users.ts`
  - `app/actions/admin/brands.ts`
  - `app/actions/admin/categories.ts`
  - `app/actions/admin/warehouses.ts`
  - `app/actions/admin/locations.ts`
- 효과
  - 권한 실패 처리(status/code/message) 일관화
  - `users` 액션의 admin 접근 검사 중복 제거

## 이번 배포(7차) 적용 범위
- admin 액션 DTO 타입 정리 (`any` 제거)
  - `app/actions/admin/products.ts`
  - `app/actions/admin/users.ts`
  - `app/actions/admin/brands.ts`
  - `app/actions/admin/categories.ts`
  - `app/actions/admin/warehouses.ts`
  - `app/actions/admin/locations.ts`
- 개선 내용
  - Supabase `Database` 기반 `Row/Insert/Update` 타입 적용
  - 액션 입력 DTO(`Create*Input`, `Update*Input`) 명시
  - 리스트 응답의 조인 필드 타입 최소 명시(`unknown` 구조 필드 분리)

## 이번 배포(8차) 적용 범위
- Route thin wrapper 상태코드 매핑 표준화
  - 대상: `customers` wrapper
    - `app/api/admin/customers/route.ts`
    - `app/api/admin/customers/[id]/route.ts`
- 개선 내용
  - 액션 결과의 `result.status` 우선 반영 (`status || 500`)
  - `getCustomerByIdAction`의 404를 라우트에서 그대로 전달

## 이번 배포(9차) 적용 범위
- 도메인: `customers` nested CRUD (`contacts/contracts/pricing/activities`)
- 신규 Action
  - `app/actions/admin/customer-details.ts`
  - `list/create/update/delete` 패턴으로 하위 리소스 CRUD 액션화
- 호환 유지(Route thin wrapper)
  - `app/api/admin/customers/[id]/contacts/route.ts`
  - `app/api/admin/customers/[id]/contacts/[contactId]/route.ts`
  - `app/api/admin/customers/[id]/contracts/route.ts`
  - `app/api/admin/customers/[id]/contracts/[contractId]/route.ts`
  - `app/api/admin/customers/[id]/pricing/route.ts`
  - `app/api/admin/customers/[id]/pricing/[pricingId]/route.ts`
  - `app/api/admin/customers/[id]/activities/route.ts`
  - `app/api/admin/customers/[id]/activities/[activityId]/route.ts`
- 개선 내용
  - Route의 권한/DB 로직 제거 및 액션 위임
  - 에러 응답 상태코드 표준화(`result.status || 500`)
  - DB 에러 코드 기반 매핑 보강(400/404/409/500)

## 이번 배포(10차) 적용 범위
- 도메인: `customers` API 응답 스키마 통일
- 대상 Route
  - `app/api/admin/customers/route.ts`
  - `app/api/admin/customers/[id]/route.ts`
  - `app/api/admin/customers/[id]/contacts/route.ts`
  - `app/api/admin/customers/[id]/contacts/[contactId]/route.ts`
  - `app/api/admin/customers/[id]/contracts/route.ts`
  - `app/api/admin/customers/[id]/contracts/[contractId]/route.ts`
  - `app/api/admin/customers/[id]/pricing/route.ts`
  - `app/api/admin/customers/[id]/pricing/[pricingId]/route.ts`
  - `app/api/admin/customers/[id]/activities/route.ts`
  - `app/api/admin/customers/[id]/activities/[activityId]/route.ts`
- 개선 내용
  - `NextResponse.json` 직접 반환 제거
  - `lib/api/response`의 `ok/fail` 포맷으로 일괄 전환
  - 실패 시 `result.code`/`result.status`를 우선 반영

## 이번 배포(11차) 적용 범위
- 도메인: `products`, `brands`, `warehouses`, `locations` API 응답 스키마 통일
- 대상 Route
  - `app/api/admin/products/route.ts`
  - `app/api/admin/brands/route.ts`
  - `app/api/admin/brands/[id]/route.ts`
  - `app/api/admin/warehouses/route.ts`
  - `app/api/admin/warehouses/[id]/route.ts`
  - `app/api/admin/locations/route.ts`
  - `app/api/admin/locations/[id]/route.ts`
- 개선 내용
  - `NextResponse.json` 직접 반환 제거
  - `lib/api/response`의 `ok/fail` 반환으로 통일
  - 실패 시 `result.code`/`result.status`를 우선 반영

## 이번 배포(12차) 적용 범위
- 도메인: 잔여 thin wrapper 응답 포맷 정리
- 대상 Route
  - `app/api/admin/categories/route.ts`
  - `app/api/admin/users/managers/route.ts`
- 개선 내용
  - `lib/api/response`의 `ok/fail` 포맷으로 전환
  - 실패 시 `result.code`/`result.status` 우선 반영

## 기대 효과
- CRUD 비즈니스 로직 단일화 (Route/Client 중복 제거)
- 권한/에러 처리 규칙 일관성 확보
- 점진적 전환이 가능해 기능 리스크 최소화

## 2차 이후 권장 전환 순서
1. `okResult`/`failResult` 헬퍼 전면 적용(반환 포맷 완전 통일)
2. 내부 미사용 API Route 정리(외부 연동/웹훅 제외)
3. non-CRUD admin 라우트(`inventory`, `alerts`, `reports` 등)의 응답/에러 코드 표준화

## 검증 체크리스트
- 고객사 목록/검색/필터 정상 동작
- 고객사 상세 조회 정상 동작
- 신규 입고 화면 메타(고객사) 로딩 정상 동작
- 권한 없는 계정에서 동일하게 거부되는지 확인
- 고객사 생성/수정/비활성화 API 하위호환 확인
