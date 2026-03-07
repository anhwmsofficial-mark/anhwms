# Multi-SKU Inspection Design

## 목표
- 기존 단일 품목 검수 플로우를 유지한다.
- `inbound_receipt_lines` 여러 건을 한 번에 안전하게 저장할 수 있게 한다.
- 모바일/PC 모두에서 사용할 수 있는 최소한의 다품목 입력 UI를 제공한다.
- 데이터 오염을 막기 위해 부분 저장보다 "전체 라인 배열 저장"을 우선 원칙으로 둔다.

## 현재 플로우 분석

### 화면
- `app/(admin)/admin/inbound/[id]/inspect/page.tsx`
- 기존 화면은 `receivedQty`, `rejectedQty`, `condition`, `note` 단일 상태만 가진다.
- `inbound.lines.length > 1`이면 검수 자체를 막고 안내 문구만 보여준다.

### 상세 조회 API
- `app/api/inbound/[id]/route.ts`
- 기존에도 `lines` 배열을 내려주고 있었지만, 다품목 저장에 필요한 `receiptLineId`, `planLineId`, `note` 같은 식별/편집 필드가 부족했다.

### 저장 API
- `app/api/inbound/[id]/inspect/route.ts`
- 기존 POST는 단건 payload만 받는다.
- `lines.length > 1`이면 즉시 `BAD_REQUEST`로 차단한다.
- 단건 라인만 직접 update 하고, 확정 시 `confirm_inbound_receipt` RPC를 바로 호출한다.

### 서비스
- `services/inbound/inboundService.ts`
- `saveReceiptLinesService()`는 이미 라인 배열 기반으로 저장할 수 있다.
- 다만 입력된 `plan_line_id` 집합을 기준으로 stale line 정리 로직이 있어, **일부 라인만 보내면 누락 라인이 삭제될 수 있다.**
- 따라서 다품목 저장은 "부분 patch"보다 **전체 라인 스냅샷 저장**이 안전하다.

## 단일 품목 전제 지점

### 명시적 단일 품목 차단
- `app/api/inbound/[id]/inspect/route.ts`
- `lines.length > 1`일 때 모바일 검수 불가로 차단하고 있었다.

### 단일 상태 모델
- `app/(admin)/admin/inbound/[id]/inspect/page.tsx`
- 수량/상태/메모가 모두 전역 단일 상태다.
- 다품목일 때 라인별 입력 상태를 담을 구조가 없다.

### payload 구조
- 기존 payload:
```json
{
  "receivedQty": 10,
  "rejectedQty": 1,
  "condition": "GOOD",
  "note": "memo",
  "completeInbound": false
}
```

- 다품목 최소 payload:
```json
{
  "lines": [
    {
      "receiptLineId": "...",
      "planLineId": "...",
      "productId": "...",
      "expectedQty": 10,
      "acceptedQty": 9,
      "damagedQty": 1,
      "note": "박스 찌그러짐"
    }
  ],
  "completeInbound": false
}
```

## 이번 최소 구현안

## 구현 범위
- `app/api/inbound/[id]/route.ts`
  - 다품목 검수에 필요한 라인 식별/편집 필드 추가
- `app/api/inbound/[id]/inspect/route.ts`
  - 단건 payload + 다품목 `lines[]` payload 동시 지원
  - 저장은 `saveReceiptLinesService()` 재사용
  - 확정은 `confirmReceiptService()` 재사용
- `app/(admin)/admin/inbound/[id]/inspect/page.tsx`
  - 라인이 2건 이상일 때만 리스트형 입력 UI 활성화
  - 모바일 카드형 / 데스크톱 테이블형 반응형 UI

## UI/UX 설계

### 단일 품목
- 기존 UI 유지
- 양품/불량/상태/메모를 기존 방식대로 입력

### 다품목
- 모바일:
  - 상품별 카드 UI
  - 상품명 / SKU / 예정 수량 / 양품 / 불량 / 비고
- PC:
  - 테이블 UI
  - 상품 / 예정 / 양품 / 불량 / 비고 컬럼

### 액션 구분
- 이번 최소 구현에서는 기존 호환을 위해 "저장" 버튼 + "확정" 체크박스 구조를 유지한다.
- 후속 단계에서는 아래처럼 분리 권장:
  1. `검수 저장`
  2. `검수 저장 후 확정`

## 상태 전이 및 검증 규칙

### 저장 시
- 다품목 저장은 **모든 라인을 함께 전송**해야 한다.
- 일부 라인만 보내는 저장은 허용하지 않는다.
  - 이유: 기존 서비스의 stale line 정리 로직과 충돌 위험
- 0 입력 자체는 허용한다.
  - 단, 이 값으로 확정하면 수량 차이 검증에서 `DISCREPANCY`로 전환될 수 있다.

### 확정 시
- `confirmReceiptService()`의 기존 검증을 그대로 사용한다.
- 필수 사진 누락 시 확정 실패
- 라인별 합계와 예정 수량이 다르면 `DISCREPANCY`
- 동일 문서 재확정은 기존 상태 체크로 차단

### 라인별 수량 규칙
- 저장 payload 기준:
  - `acceptedQty >= 0`
  - `damagedQty >= 0`
  - 총 실입고 = `acceptedQty + damagedQty + missingQty + otherQty`
- 최소 구현에서는 `missingQty`, `otherQty`는 0 고정
- 후속 단계에서 부족/초과/기타 사유를 라인별로 세분화 가능

## 호환성 유지 방안

### API 호환
- 기존 단일 payload는 그대로 지원한다.
- 라인 1건이면 기존 단건 UI/요청 구조가 계속 동작한다.
- 라인 2건 이상일 때만 신규 `lines[]` payload를 사용한다.

### 화면 호환
- 기존 단일 검수 화면은 유지된다.
- 다품목일 때만 추가 UI가 활성화된다.

### 서비스 호환
- 신규 다품목 저장도 기존 `saveReceiptLinesService()`를 재사용한다.
- 확정도 기존 `confirmReceiptService()`를 재사용한다.
- 즉, 핵심 비즈니스 로직을 새로 만들지 않고 기존 안전 로직을 활용한다.

## 변경 전/변경 후 동일 동작 보장 항목

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 단일 품목 검수 진입 | 가능 | 동일 |
| 단일 품목 저장 payload | 단건 body | 동일 |
| 단일 품목 확정 | 가능 | 동일 |
| 필수 사진 검증 | 확정 시 동작 | 동일 |
| 다품목 검수 | 차단 | 라인 배열 입력 UI로 허용 |
| 다품목 부분 저장 | 없음 | 여전히 허용하지 않음 |

## 영향받는 파일 목록

1. `app/(admin)/admin/inbound/[id]/inspect/page.tsx`
2. `app/api/inbound/[id]/route.ts`
3. `app/api/inbound/[id]/inspect/route.ts`
4. `services/inbound/inboundService.ts` (재사용 영향 분석 대상)

## 남아 있는 리스크

1. `saveReceiptLinesService()`는 아직 DB 트랜잭션 RPC가 아니다.
2. 다품목 저장 시 `inbound_inspections`도 라인 수만큼 insert 되므로, 향후 배치/트랜잭션화가 필요하다.
3. 현재 최소 구현은 `acceptedQty`, `damagedQty`, `note` 중심이라 `missingQty`, `otherQty`, `location_id` 편집은 후속 범위다.
4. "저장"과 "확정" 버튼이 완전히 분리되지 않았으므로 모바일 UX는 후속 개선 여지가 있다.

## 후속 개발 우선순위

### 1순위
- `saveReceiptLinesService()` RPC화
- 다품목 검수 API 테스트 추가
- 확정 전 라인별 미입력/합계 mismatch UI 검증 강화

### 2순위
- 저장 / 확정 버튼 분리
- `missingQty`, `otherQty`, `location_id` 지원
- 라인별 사진 첨부 지원

### 3순위
- 바코드 스캔 기반 라인 자동 포커스
- 모바일 최적화 입력 키패드 / 빠른 입력 UX
- 부분 저장 초안 기능

## 추천 적용 순서

1. 이번 최소 구현으로 PC/모바일 다품목 입력 지원
2. 운영 검증 후 저장/확정 분리 UX 적용
3. 트랜잭션 RPC와 라인별 세부 사유 입력으로 고도화

## 권장 운영 방향
- **지금은 모바일/PC 동시 지원은 하되, 운영 우선순위는 PC 검수 안정화가 먼저**다.
- 이유:
  - 다품목은 화면 밀도가 높고 검수자 실수가 발생하기 쉽다.
  - 초기 운영에서는 PC 관리자 화면으로 먼저 검증하고, 모바일은 카드형 UX를 점진적으로 다듬는 것이 안전하다.
