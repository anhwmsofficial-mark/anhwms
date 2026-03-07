# Phase 2 운영 안정성 개선 보고서

> **작성일**: 2026년 3월 7일  
> **작성자**: AI Assistant  
> **목표**: 장애 추적성 강화, 보안 취약점 제거, 핵심 프로세스 정합성 확보

---

## 1. 개선 요약

외부 기술 감사 결과에서 지적된 **Critical** 및 **High** 등급 리스크를 중심으로, 운영 안정성을 확보하기 위한 Phase 2 작업을 완료했습니다.
주요 성과는 다음과 같습니다:

1. **장애 추적성 확보**: 모든 요청에 `x-request-id`를 부여하고, 이를 감사 로그(Audit Log)와 연동하여 "누가, 언제, 어떤 요청으로" 변경했는지 추적 가능하게 했습니다.
2. **데이터 정합성 해결**: 입고 검수 API가 잘못된 테이블(`inbounds`)을 참조하던 문제를 수정하여 표준 스키마(`inbound_shipment`)로 통합했습니다.
3. **보안 강화**: 관리자 검색 기능 전반에 존재하던 SQL Injection 취약점을 `escapeLike` 유틸리티로 방어하고, 역할 기반 접근 제어(RBAC)를 강화했습니다.

---

## 2. 상세 개선 내역

### 2.1 로깅 및 감사 시스템 고도화
- **Middleware 개선**: 모든 HTTP 요청에 UUID 기반 `x-request-id` 헤더를 자동 주입하도록 수정했습니다.
- **Audit Log 스키마 확장**: `audit_logs` 테이블에 `request_id`, `route`, `action_name`, `entity_type`, `metadata` 컬럼을 추가했습니다.
- **Trigger 개선**: DB 레벨의 변경 사항도 가능한 경우 `request_id`를 캡처하도록 트리거 함수를 개선했습니다.
- **Admin UI 구현**: `/admin/audit-logs` 페이지를 신설하여 운영자가 필터링(Action, Entity, User) 및 페이지네이션을 통해 로그를 조회할 수 있게 했습니다.

### 2.2 입고 검수(Inbound Inspect) API 정상화
- **문제점**: 기존 API가 레거시 테이블(`inbounds`)을 사용하고, GET 핸들러가 없어 검수 화면 진입이 불가능했습니다.
- **해결**:
  - `GET /api/inbound/[id]/inspect`: `inbound_shipment`와 `inbound_shipment_line`을 조인하여 정확한 검수 대상을 반환하도록 구현했습니다.
  - `POST /api/inbound/[id]/inspect`: 검수 수량(`qty_received`)과 불량 수량(`qty_damaged`)을 라인별로 업데이트하고, 헤더 상태를 동기화하도록 재작성했습니다.
  - **권한 제어**: `canOperate` 유틸리티를 적용하여 운영 권한(Operator) 이상만 접근 가능하도록 제한했습니다.

### 2.3 보안 취약점 조치 (SQL Injection)
- **문제점**: `query.or('name.ilike.%${search}%')` 패턴 사용 시 `%`나 `_` 문자를 통한 과도한 매칭 또는 인젝션 가능성이 있었습니다.
- **해결**: `lib/utils.ts`에 `escapeLike` 함수를 추가하고, 주요 Admin Action 파일(`customers.ts`, `products.ts` 등)에 적용하여 특수문자를 이스케이프 처리했습니다.

### 2.4 RBAC (역할 기반 접근 제어) 체계화
- **Role 정의**: `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER` 계층 구조를 코드 레벨(`lib/rbac.ts`)에 정의했습니다.
- **검증 로직**: `hasPermission`, `canManageSystem`, `canOperate` 등의 헬퍼 함수를 통해 권한 검증 로직을 일관성 있게 적용했습니다.

---

## 3. 테스트 및 검증

### 3.1 E2E 테스트 추가
- **파일**: `tests/api/inbound-inspect.spec.ts`
- **시나리오**:
  1. 관리자 권한으로 로그인 (토큰 발급)
  2. 테스트용 창고, 상품, 입고 예정 데이터 생성
  3. `GET` API 호출하여 데이터 구조 검증
  4. `POST` API 호출하여 검수 처리 (정상/불량 수량 입력)
  5. DB 업데이트 확인 및 `audit_logs`에 `INSPECT` 액션과 `request_id`가 기록되었는지 검증
  6. 테스트 데이터 정리

### 3.2 수동 검증 포인트
- Admin 메뉴의 "감사 로그" 페이지에서 API 호출에 따른 로그가 실시간으로 적재되는지 확인 필요.
- 입고 검수 화면에서 실제 검수 진행 시 에러 없이 상태가 변경되는지 확인 필요.

---

## 4. 향후 과제 (Phase 3 제안)

- **Sentry 연동 심화**: 현재 미들웨어에서 생성한 `request_id`를 Sentry Scope에 태깅하여, 에러 리포트와 감사 로그를 1:1로 매핑.
- **Cycle Count 구현**: 현재 설계 단계인 재고 실사 기능을 `inventory_ledger`와 연동하여 구현.
- **파일 업로드 최적화**: 이미지 리사이징 및 바이러스 스캔 도입.

---
