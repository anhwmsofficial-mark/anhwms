# 배포 체크리스트 (Deploy Checklist Phase 2)

## 1. 사전 준비

- [ ] `supabase/migrations/20260307000000_inbound_transaction_rpcs.sql` 마이그레이션 파일이 준비되었는가?
- [ ] `utils/supabase/tenant-security.ts` 파일이 생성되었는가?
- [ ] `lib/api/errors.ts`에 `ERROR_CODES`가 정의되었는가?

## 2. 마이그레이션 적용 순서

1.  **DB 마이그레이션 실행**:
    *   `supabase db push` 또는 SQL Editor에서 `20260307000000_inbound_transaction_rpcs.sql` 실행.
    *   `create_inbound_plan_full`, `update_inbound_plan_full` 함수 생성 확인.

2.  **코드 배포**:
    *   `services/inbound/inboundService.ts` (RPC 적용 버전)
    *   `app/actions/inbound.ts` (에러 표준화 적용 버전)
    *   `app/api/admin/inventory/import-staging/upload-file/route.ts` (업로드 방어 로직 적용 버전)
    *   `app/api/admin/inventory/ledger/route.ts` (Admin Client 제거 버전)
    *   `app/api/admin/customers/route.ts` (에러 표준화 적용 버전)
    *   `app/api/admin/audit-logs/route.ts` (에러 표준화 적용 버전)
    *   `lib/api/errors.ts`, `lib/actions/result.ts` (공통 모듈 업데이트)

## 3. 수동 검증 항목 (Smoke Test)

### 3.1. 입고 관리 (Inbound)
- [ ] **입고 예정 등록**: 정상 등록되는가? (Plan -> Lines -> Receipt -> Slots 생성 확인)
- [ ] **입고 예정 수정**: 라인 수정 시 기존 라인이 삭제되고 새 라인이 정상 등록되는가?
- [ ] **입고 검수**: 사진 업로드 및 수량 입력이 정상 동작하는가?
- [ ] **입고 확정**: 확정 처리 후 재고에 반영되는가?

### 3.2. 재고 업로드 (Inventory Upload)
- [ ] **정상 파일**: 1MB 이하, 100행 미만 엑셀 파일 업로드 성공 확인.
- [ ] **용량 초과**: 6MB 이상 파일 업로드 시 에러 메시지 확인 (`FILE_TOO_LARGE`).
- [ ] **형식 오류**: `.txt` 파일 업로드 시 에러 메시지 확인 (`INVALID_FILE`).
- [ ] **행수 초과**: 2000행 파일 업로드 시 에러 메시지 확인 (`ROW_LIMIT_EXCEEDED`).

### 3.3. 관리자 기능 (Admin)
- [ ] **고객사 목록**: `/admin/customers` 접근 시 목록이 정상 조회되는가?
- [ ] **재고 수불부**: 상품 상세 페이지에서 수불부 탭 조회 시 데이터가 나오는가?
- [ ] **감사 로그**: `/admin/audit-logs` 접근 시 로그가 조회되는가?

## 4. 롤백 포인트 (Rollback Plan)

만약 배포 후 심각한 오류 발생 시:

1.  **코드 롤백**:
    *   `services/inbound/inboundService.ts`를 이전 버전(JS 로직)으로 원복.
    *   `app/api/admin/inventory/ledger/route.ts`를 `createAdminClient` 사용하는 버전으로 원복.

2.  **DB 롤백 (선택 사항)**:
    *   RPC 함수(`create_inbound_plan_full` 등)는 굳이 삭제하지 않아도 됨 (사용 안 하면 그만).
    *   단, 데이터가 꼬였다면 백업본 복구 필요.
