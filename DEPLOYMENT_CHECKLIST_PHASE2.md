# Phase 2 배포 전 최종 체크리스트

> **목표**: 입고 검수 정상화 및 감사 로그 시스템의 안전한 운영 반영

---

## 1. 사전 준비 (Pre-Deployment)

### 1.1 DB 마이그레이션 확인
- [ ] **파일**: `supabase/migrations/20260307150000_audit_log_v2.sql`
- [ ] **내용**: `audit_logs` 테이블 컬럼 추가 (`request_id`, `route` 등) 및 `audit_log`(단수형) 데이터 이관
- [ ] **주의사항**: `audit_log` 테이블이 이미 있고 데이터가 많다면 마이그레이션 시간이 걸릴 수 있음. (현재 개발 환경 기준 데이터 양 적음)
- [ ] **권한 확인**: 마이그레이션 수행 계정이 `postgres` 또는 `superuser` 권한인지 확인.

### 1.2 환경변수 확인
- [ ] `SUPABASE_SERVICE_ROLE_KEY`: 서버 사이드 Admin Action 수행을 위해 필수.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 기본 연동.

---

## 2. 운영 점검 시나리오 (Manual Verification)

배포 직후 아래 순서대로 운영 환경에서 직접 테스트하세요.

### 2.1 입고 검수 (핵심 경로)
1. **입고 상세 조회**
   - [ ] `/admin/inbound` 목록에서 '접수' 상태인 건의 상세 페이지 진입.
   - [ ] 에러 없이 상품명, 수량, 공급사 정보가 표시되는지 확인.
   - [ ] **기대 결과**: 404 에러 없이 데이터 로딩 완료.

2. **검수 저장 (Legacy UI 호환성)**
   - [ ] '수량 입력' 필드에 숫자 입력 (예: 5)
   - [ ] '검수 결과 저장' 버튼 클릭.
   - [ ] **기대 결과**: "검수가 완료되었습니다" 토스트 메시지 표시 및 목록으로 이동.

3. **입고 확정**
   - [ ] 목록에서 해당 입고 건 상태가 'PARTIAL' 또는 입력한 상태로 변경되었는지 확인.
   - [ ] DB `inbound_shipment_line`의 `qty_received`가 업데이트되었는지 확인 (가능하다면).

### 2.2 감사 로그 (Audit Log)
1. **로그 생성 확인**
   - [ ] `/admin/audit-logs` 페이지 접속.
   - [ ] 방금 수행한 '입고 검수' 액션이 최상단에 있는지 확인.
   - [ ] **기대 결과**: Action=`INSPECT`, Entity=`INBOUND`, RequestID 값 존재.

2. **필터링 테스트**
   - [ ] 필터에서 Action을 `INSPECT`로 선택하고 검색.
   - [ ] **기대 결과**: 해당 로그만 필터링되어 표시됨.

### 2.3 권한 제어 (RBAC)
1. **관리자 접근**
   - [ ] Admin 계정으로 `/admin/audit-logs` 접근 가능 확인.
2. **비권한 접근 (테스트 가능 시)**
   - [ ] Viewer 권한 계정으로 로그인 후 `/admin/audit-logs` 접근 시도.
   - [ ] **기대 결과**: 403 Forbidden 또는 홈으로 리다이렉트.

---

## 3. 롤백 계획 (Rollback Plan)

### 3.1 롤백 트리거 조건
- [ ] 입고 검수 페이지 진입 시 500 에러 지속 발생.
- [ ] `inbound_shipment` 데이터가 손상되거나 사라짐.
- [ ] 기존 운영 기능(주문 등)에 치명적인 사이드 이펙트 발생.

### 3.2 롤백 절차
1. **코드 롤백**: 이전 안정 버전(Commit ID 확인)으로 Revert 배포.
2. **DB 롤백** (필요시):
   ```sql
   -- audit_logs 컬럼 추가 롤백은 데이터 손실 위험이 있으므로 신중해야 함.
   -- 단순히 코드만 롤백해도 DB 컬럼이 남는 것은 큰 문제 없음.
   -- 치명적인 경우에만 아래 실행
   ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS request_id;
   ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS route;
   -- ... 기타 컬럼 삭제
   ```

---
