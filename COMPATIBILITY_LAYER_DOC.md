# 입고 검수 호환성 레이어 (Compatibility Layer)

> **적용 대상**: `GET /api/inbound/[id]`, `POST /api/inbound/[id]/inspect`  
> **관련 이슈**: 프론트엔드(`inbounds` 테이블 기준)와 백엔드(`inbound_shipment` 테이블 기준) 스키마 불일치

---

## 1. 동작 방식

### 1.1 GET Adapter (`/api/inbound/[id]`)
프론트엔드가 기대하는 레거시 필드를 `inbound_shipment` 데이터에서 계산하여 매핑합니다.

| 프론트엔드 필드 (Legacy) | 백엔드 데이터 소스 (New) | 변환 로직 |
|---|---|---|
| `quantity` | `inbound_shipment_line` (List) | 모든 라인의 `qty_expected` 합계 |
| `received_quantity` | `inbound_shipment_line` (List) | 모든 라인의 `qty_received` 합계 |
| `productName` | `product` (Join) | 첫 번째 라인의 상품명 + "외 N건" |
| `supplierName` | `customer_master` (Join) | `supplier_customer_id`로 조회 |

### 1.2 POST Legacy Handling (`/api/inbound/[id]/inspect`)
프론트엔드가 단일 수량만 보내는 경우를 감지하여 처리합니다.

- **감지 조건**: Request Body에 `lines` 배열이 없고 `receivedQty` 숫자 필드가 존재함.
- **처리 로직**:
  1. DB에서 해당 입고 건의 **첫 번째 라인 ID**를 조회.
  2. 프론트엔드가 보낸 `receivedQty`, `rejectedQty`를 첫 번째 라인에 업데이트.
  3. `completeInbound` 플래그가 `true`면 헤더 상태를 `COMPLETED`로 변경.

---

## 2. 제거 가능 시점

이 호환성 레이어는 **프론트엔드 코드가 업데이트될 때까지 유지**되어야 합니다.

### 제거 조건
1. Admin 페이지(`app/(admin)/admin/inbound/[id]/inspect/page.tsx`)가 `lines` 배열을 순회하며 입력받도록 수정됨.
2. API 호출 시 `receivedQty` 대신 `{ lines: [{ id, qty_received, ... }] }` 형태로 페이로드를 전송함.

### 권장 계획
- **Phase 3**: 프론트엔드 입고 검수 UI 개편 (다중 상품 검수 지원).
- **Phase 4**: API에서 레거시 처리 로직(`if (!body.lines) ...`) 제거.

---
