# inbound/new 회귀 체크리스트

## 0) 사전 분석 (코드 변경 전 기준)

### a) API 호출 목록 (엔드포인트/메서드/파라미터/바디)
- `GET /api/admin/customers?status=ACTIVE&limit=2000`
  - 사용 위치: 메타 로딩(`fetchMeta`)
  - 파라미터: 쿼리스트링 `status=ACTIVE`, `limit=2000`
  - 바디: 없음
- `GET /api/admin/users/managers`
  - 사용 위치: 메타 로딩(`fetchMeta`)
  - 파라미터: 없음
  - 바디: 없음
- `supabase.auth.getUser()`
  - 사용 위치: 메타 로딩(`fetchMeta`)
  - 파라미터/바디: 없음
- `supabase.from('org').select('id').limit(1)`
  - 사용 위치: 메타 로딩(`fetchMeta`)
  - 파라미터: 테이블 `org`, 컬럼 `id`, `limit(1)`
  - 바디: 없음
- `supabase.from('warehouse').select('id, name').eq('status', 'ACTIVE').eq('type', 'ANH_OWNED').order('name')`
  - 사용 위치: 메타 로딩(`fetchMeta`)
  - 파라미터: `status=ACTIVE`, `type=ANH_OWNED`, `order=name`
  - 바디: 없음
- `searchProducts(query, clientId)`
  - 사용 위치:
    - 상품 자동완성 검색
    - 바코드 스캔 처리
    - 엑셀 SKU 매칭
    - 엑셀 바코드 매칭
  - 파라미터: `query: string`, `clientId: string`
  - 바디: 없음(서버 액션 내부 처리)
- `POST /api/admin/products`
  - 사용 위치: 엑셀 업로드 시 SKU/바코드 매칭 실패한 품목 자동 생성
  - 바디(JSON):
    - `name`, `sku`, `barcode`, `category`, `quantity`, `unit`, `min_stock`, `price`, `location`, `description`
- `createInboundPlan(formData)`
  - 사용 위치: 최종 제출(`handleSubmit`)
  - 바디(FormData):
    - `org_id`
    - `client_id`
    - `planned_date`
    - `warehouse_id`
    - `inbound_manager`
    - `notes`
    - `lines`(JSON.stringify 처리된 라인 배열)

### b) 상태(state) 목록과 역할
- `loading`: 저장 진행 상태
- `clients`: 화주사 목록
- `warehouses`: 창고 목록
- `managers`: 입고담당자 목록
- `selectedClientId`: 선택 화주사 ID
- `plannedDate`: 입고 예정일
- `selectedWarehouseId`: 선택 창고 ID
- `inboundManager`: 선택 입고담당자 이름
- `planNotes`: 상단 비고
- `scannerOpen`: 바코드 스캐너 모달 표시 여부
- `scanAccumulate`: 동일 상품 스캔 시 수량 누적 여부
- `submitted`: 제출 시도 여부(필수 입력 강조용)
- `lines`: 입고 품목 라인 배열
- `userOrgId`: 사용자 조직 ID

### c) 폼 validation 규칙 (zod/rhf)
- 현재 `zod`/`react-hook-form` 미사용.
- 제출 전 수동 검증:
  - 필수 헤더 값 누락 시 중단:
    - `userOrgId`, `selectedClientId`, `plannedDate`, `selectedWarehouseId`, `inboundManager`
    - `inboundManager` 누락 시 `alert('입고담당자를 입력해주세요.')`
  - 유효 라인(`product_id` 존재) 0개면 중단:
    - `alert('입고 품목(SKU)이 유효하지 않습니다. 상품을 검색하여 선택해주세요.')`
  - 유효 라인 중 `expected_qty <= 0` 존재 시 중단:
    - `alert('모든 품목의 수량을 입력해주세요.')`

### d) 엑셀 파싱 입력/출력 구조
- 업로드 파싱은 `ExcelUpload`에서 수행 후 `onDataLoaded(data)` 전달.
- `handleExcelData` 입력(`ExcelInboundRow[]`) 키:
  - `product_sku`, `product_name`, `product_category`, `product_barcode`, `expected_qty`, `box_count`, `pallet_text`, `mfg_date`, `expiry_date`, `line_notes`
- `handleExcelData` 처리:
  - trim/number 정규화
  - `product_sku && expected_qty > 0` 필터
  - SKU 기준 `expected_qty` 합산
  - SKU 검색 -> 바코드 검색 -> 제품 자동 생성 순으로 매칭
  - 실패 SKU 집계 후 alert
  - 기존 유효 라인 뒤에 생성 라인 append
- 최종 라인(`InboundLine`) 키:
  - `id`, `product_id`, `product_name`, `product_sku`, `barcode_primary`, `barcode_type_primary`, `barcodes`, `expected_qty`, `box_count`, `pallet_text`, `mfg_date`, `expiry_date`, `line_notes`, `notes`

### e) 에러 처리 흐름 (try/catch, toast, alert, setError)
- `fetchMeta` managers 조회 실패: `console.error('Failed to fetch managers', e)`
- 자동완성 검색 실패: `console.error(e)` (UI alert 없음)
- 스캔 매칭 실패: `alert(\`바코드 매칭 실패: \${barcode}\`)`
- 엑셀 빈 데이터: `alert('엑셀 데이터가 없습니다.')`
- 엑셀 유효 데이터 0건: `alert('유효한 SKU/수량 데이터가 없습니다.')`
- 엑셀 품목 처리 실패 누적: `alert(\`일부 SKU 처리 실패: ...\`)`
- 제품 자동 생성 실패: `throw new Error(payload?.error || '제품 생성 실패')` 후 catch에서 실패 SKU 누적
- 제출 실패(result error): `alert('오류 발생: ' + result.error)`
- 제출 성공: `router.push('/inbound')`
- 본 페이지 기준 `toast`, `setError` 사용 없음.

## 1) 주요 유저 플로우 체크리스트
- [ ] 페이지 진입 시 화주사/창고/담당자 메타가 동일하게 로딩된다.
- [ ] 화주사/예정일/창고/담당자/비고 입력 흐름이 동일하다.
- [ ] 품목 수동 검색(자동완성) 선택 시 SKU/바코드 표시가 동일하다.
- [ ] 바코드 스캔 시 누적 로직/신규 라인 추가 로직이 동일하다.
- [ ] 엑셀 업로드 시 유효행 필터, SKU 합산, 제품 매칭/생성, 실패 SKU alert가 동일하다.
- [ ] 저장 시 FormData 키/값(`lines` JSON 포함)이 동일하다.
- [ ] 저장 성공 시 `/inbound` 이동 동작이 동일하다.

## 수동 검증 시나리오
1. `/inbound/new` 진입 후 헤더 텍스트(`신규 입고 예정 등록`)와 기본 입력 섹션 노출 확인.
2. `업체명`, `입고 예정일`, `입고지 주소`, `입고담당` 순으로 입력.
3. 엑셀 업로드:
   - 템플릿(`inbound_template.xlsx`) 또는 동일 헤더의 샘플 사용
   - 업로드 후 SKU 표시/라인 추가/수량 반영 확인
4. 라인에서 수량/박스/PLT/제조일/유통기한 일부 수정 후 값 반영 확인.
5. 저장 버튼 클릭:
   - 정상 케이스: `/inbound`로 이동하는지 확인
   - 오류 케이스 1개: 필수값 누락 또는 잘못된 엑셀로 기존 alert 문구 동일 확인

### 수동 검증 샘플 헤더 (엑셀)
- `SKU`, `상품명`, `카테고리`, `바코드`, `바코드유형(RETAIL/SET)`, `박스수`, `팔렛`, `제조일`, `유통기한`, `수량(Qty)`, `비고`

## E2E 실행 플래그
- 스모크(기본 UI): `E2E_RUN_INBOUND_NEW=1`
- 플로우 스모크(비파괴): `E2E_RUN_INBOUND_NEW_FLOW=1`
- 플로우 뮤테이션(실제 저장): `E2E_RUN_INBOUND_NEW_MUTATION=1`

### 뮤테이션 테스트 데이터 식별자
- 뮤테이션 테스트는 상단 비고에 `E2E-INBOUND-NEW-{timestamp}` 값을 입력한다.
- 생성 데이터 조회/정리 시 비고 prefix `E2E-INBOUND-NEW-`로 검색한다.
- 정리 SQL: `docs/refactor/inbound-new-e2e-cleanup.sql`

## 2) API 호출 목록 (요약)
- `GET /api/admin/customers?status=ACTIVE&limit=2000`
- `GET /api/admin/users/managers`
- `supabase.auth.getUser()`
- `supabase.from('org')...`
- `supabase.from('warehouse')...`
- `searchProducts(query, clientId)`
- `POST /api/admin/products` (자동 생성)
- `createInboundPlan(formData)`

## 3) 엑셀 입력 샘플
- 현재 템플릿 다운로드 파일명: `inbound_template.xlsx`
- 템플릿 헤더:
  - `SKU`, `상품명`, `카테고리`, `바코드`, `바코드유형(RETAIL/SET)`, `박스수`, `팔렛`, `제조일`, `유통기한`, `수량(Qty)`, `비고`

## 4) 파싱 결과 필드 스키마 (키 목록)
- 입력 행(`ExcelUpload -> onDataLoaded`)
  - `product_sku`
  - `product_name`
  - `product_category`
  - `product_barcode`
  - `expected_qty`
  - `box_count`
  - `pallet_text`
  - `mfg_date`
  - `expiry_date`
  - `line_notes`
- 페이지 내부 최종 라인(`InboundLine`)
  - `id`
  - `product_id`
  - `product_name`
  - `product_sku`
  - `barcode_primary`
  - `barcode_type_primary`
  - `barcodes`
  - `box_count`
  - `pallet_text`
  - `expected_qty`
  - `mfg_date`
  - `expiry_date`
  - `line_notes`
  - `notes`

## 5) 에러 케이스 문구 (동일성 확인용)
- `엑셀 데이터가 없습니다.`
- `유효한 SKU/수량 데이터가 없습니다.`
- `일부 SKU 처리 실패: {sku 목록}`
- `바코드 매칭 실패: {barcode}`
- `입고담당자를 입력해주세요.`
- `입고 품목(SKU)이 유효하지 않습니다. 상품을 검색하여 선택해주세요.`
- `모든 품목의 수량을 입력해주세요.`
- `오류 발생: {error}`
