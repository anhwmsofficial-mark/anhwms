# 재고 엑셀 시스템 적용 체크리스트

## 1. 마이그레이션 적용 전 주의사항

### 적용 대상
- `supabase/migrations/20260313103000_inventory_export_templates_and_snapshot_expansion.sql`

### 적용 전 확인
- 운영 DB 백업 또는 스냅샷이 준비되어 있는지 확인합니다.
- 현재 `inventory_snapshot` 데이터 건수를 확인합니다.
- 현재 `inventory_ledger.movement_type`에 저장된 값 목록을 확인합니다.
- `customer_master.org_id`, `user_profiles.org_id`가 누락되지 않았는지 확인합니다.
- `export_templates`, `export_template_columns` 테이블이 이미 수동 생성되어 있지 않은지 확인합니다.

### 주의 포인트
- 이번 마이그레이션은 `inventory_snapshot`에 `opening_stock`, `total_in`, `total_out` 컬럼을 추가하고 기존 데이터를 백필합니다.
- 이번 마이그레이션은 `inventory_ledger`의 `movement_type` 체크 제약을 교체합니다.
- 기존 코드가 사용하는 레거시 타입과 신규 엑셀 기반 타입을 모두 허용하도록 작성되어 있지만, 운영 DB에 예상 밖 movement type이 있으면 제약 추가 시 실패할 수 있습니다.
- 기본 템플릿 `inventory-default`가 조직별로 자동 생성됩니다.
- `export_template_columns`는 템플릿별 정렬 순서 유니크 제약이 있으므로, 추후 수동 데이터 입력 시 `sort_order` 중복에 주의해야 합니다.

### 권장 적용 순서
1. 운영 DB 백업 생성
2. 기존 movement type 점검
3. 마이그레이션 적용
4. `inventory-default` 템플릿 생성 여부 확인
5. 관리자 화면과 export API 스모크 테스트 수행

## 2. 적용 후 검증 체크리스트

### DB 검증
- `inventory_snapshot`에 `opening_stock`, `total_in`, `total_out` 컬럼이 생성되었는지 확인
- 기존 `inventory_snapshot` 데이터에 새 컬럼 값이 `NULL`이 아닌지 확인
- `export_templates`, `export_template_columns` 테이블 생성 확인
- 조직별 `inventory-default` 템플릿 생성 확인
- `export_template_columns`에 기본 컬럼과 트랜잭션 컬럼이 모두 들어갔는지 확인

### UI 검증
- `/inventory` 접속 시 재고 그리드가 로드되는지 확인
- `열 설정`에서 특정 트랜잭션 컬럼 숨김/표시가 되는지 확인
- 셀 클릭 후 `재고 변동 입력` 모달이 열리는지 확인
- 재고 변동 저장 후 현재고가 즉시 갱신되는지 확인
- 음수 재고 입력 시 서버 검증 오류가 표시되는지 확인

### 템플릿 설정 검증
- `/admin/inventory/export-templates` 접속 가능 여부 확인
- 기존 `inventory-default` 템플릿이 목록에 보이는지 확인
- 트랜잭션 컬럼 체크박스 on/off 저장이 되는지 확인
- 헤더명(Display Name) 수정 후 다시 열어도 값이 유지되는지 확인
- 정렬 순서 변경 후 미리보기 순서가 저장값과 일치하는지 확인

### 엑셀 다운로드 검증
- `/inventory`에서 템플릿 선택 후 다운로드가 되는지 확인
- 다운로드 파일이 `.xlsx`로 정상 저장되는지 확인
- 시트명이 날짜 기준으로 생성되는지 확인
- 숨긴 컬럼이 실제 파일에서 제외되는지 확인
- 헤더명이 템플릿 설정값과 동일한지 확인
- `관리명`, `전일재고`, 트랜잭션 컬럼, `총합계`, `마감재고`, `비고` 순서가 맞는지 확인

## 3. 운영 스모크 테스트 시나리오

### 시나리오 A. 파손 입력
1. `/inventory`에서 품목 1개 선택
2. `파손` 셀 클릭
3. 수량 `2`, 사유 입력 후 저장
4. 현재고가 2 감소했는지 확인
5. 다시 다운로드하여 `파손` 열에 2가 반영되었는지 확인

### 시나리오 B. 컬럼 제외 다운로드
1. 템플릿 설정 페이지에서 `샘플(-)` 컬럼 체크 해제 후 저장
2. `/inventory`로 이동
3. 같은 템플릿으로 다운로드
4. 생성된 파일에 `샘플(-)` 열이 없는지 확인

### 시나리오 C. 업체별 템플릿
1. 특정 업체용 템플릿 생성 또는 수정
2. 업체 선택 후 해당 템플릿 적용
3. 다운로드 파일 헤더가 업체 요구 포맷과 일치하는지 확인

## 4. 장애 대응 포인트
- 템플릿 저장 실패 시: `export_templates`/`export_template_columns` 존재 여부와 RLS 정책 확인
- 다운로드 실패 시: `template_id`, `customer_id`, `date_from`, `date_to` 파라미터와 템플릿 활성 상태 확인
- 재고 저장 실패 시: `inventory_ledger` 체크 제약과 `warehouse_id`, `product_id` 유효성 확인
- 화면은 열리지만 데이터가 없을 때: `customer_master.org_id`, `products.customer_id`, `inventory_snapshot.tenant_id`, `inventory_ledger.tenant_id` 연결 상태 확인
