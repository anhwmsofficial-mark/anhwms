# Phase 2 배포 런북 (Deployment Runbook)

> **문서 버전**: 1.0  
> **대상 시스템**: ANH WMS (Admin & API)  
> **배포 목표**: 운영 안정성 확보 (Audit Log, 입고 검수 정상화, 보안 강화)

---

## 1. 배포 개요

이번 Phase 2 배포는 새로운 기능 추가보다는 **시스템 안정성**과 **데이터 정합성** 확보에 중점을 둡니다.

### 주요 변경 사항
1.  **감사 로그(Audit Log) 고도화**: 모든 변경 이력에 `request_id`를 부여하여 추적 가능하게 함.
2.  **입고 검수 정상화**: API 스키마 불일치 문제를 해결하고, 레거시 프론트엔드와 호환되도록 수정함.
3.  **보안 강화**: SQL Injection 취약점 패치 및 관리자 권한(RBAC) 검증 로직 강화.

### 영향 범위
- **영향 받는 사용자**: 관리자(Admin), 운영자(Operator)
- **주요 기능**: 입고 검수 화면, 감사 로그 조회, 고객사/상품 관리(검색)

---

## 2. 배포 절차 (Step-by-Step)

반드시 아래 순서를 지켜주세요. DB 변경이 선행되어야 API가 정상 동작합니다.

### STEP 1: DB 마이그레이션 적용

1.  **Supabase 대시보드** 접속 > 해당 프로젝트 선택.
2.  좌측 메뉴의 **SQL Editor** 클릭.
3.  `New Query` 버튼 클릭.
4.  아래 파일의 내용을 복사하여 붙여넣고 **Run** 실행.
    - 파일 경로: `supabase/migrations/20260307150000_audit_log_v2.sql`
    - *(참고: `audit_logs` 테이블에 컬럼을 추가하고 트리거를 업데이트하는 안전한 쿼리입니다.)*

### STEP 2: 애플리케이션 배포

**Option A: Vercel 배포 (권장)**
1.  Git Repository에 `main` (또는 배포 브랜치) 푸시.
2.  Vercel 대시보드에서 배포 상태 모니터링.
3.  환경변수 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있는지 확인 (Settings > Environment Variables).

**Option B: 수동 서버 배포**
```bash
# 1. 최신 코드 가져오기
git pull origin main

# 2. 의존성 설치
npm install

# 3. 빌드
npm run build

# 4. 서비스 재시작 (PM2 예시)
pm2 reload wms-app
```

### STEP 3: 운영 검증 (Smoke Test)

배포 직후 관리자 계정으로 접속하여 다음 항목을 확인합니다.

- 문서 참고: [`../API_SMOKE_TESTS.md`](../API_SMOKE_TESTS.md)
- 로컬 또는 검증 환경에서 최소 smoke 실행:

```bash
npm run test:api:smoke -- --reporter=line
```

- 주의:
  - smoke test는 read-only 기준으로 설계되어 있습니다.
  - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, 관리자 계정 secrets가 없으면 일부 smoke는 skip될 수 있습니다.
  - CI 기준으로는 `/api/health` smoke 1개는 반드시 실행되어야 하며, 전체 smoke가 skip되면 실패로 간주합니다.

| 검증 항목 | 수행 방법 | 기대 결과 |
|---|---|---|
| **1. 입고 조회** | `/admin/inbound` 접속 > '접수' 상태 건 클릭 | 상세 페이지가 404 없이 열리고 상품 정보가 표시됨 |
| **2. 검수 저장** | 상세 페이지에서 수량 입력 후 '저장' 클릭 | "저장되었습니다" 메시지 표시, 에러 없음 |
| **3. 검수 확정** | '검수 완료' 체크 후 저장 | 입고 상태가 변경되고 재고(Inventory)가 증가함 |
| **4. Audit Log** | `/admin/audit-logs` 접속 | 방금 수행한 검수 작업이 목록 최상단에 `INSPECT` 액션으로 기록됨 |
| **5. 권한 차단** | (가능하면) 권한 없는 계정으로 `/admin/audit-logs` 접근 | 접근 거부 또는 리다이렉트됨 |

---

## 3. 문제 발생 시 롤백 (Rollback Plan)

배포 후 **500 에러**가 지속되거나 **데이터 손실** 징후가 보이면 즉시 롤백합니다.

### 3.1 애플리케이션 롤백
1.  Vercel: 이전 배포 버전으로 **Instant Rollback** 클릭.
2.  수동 배포: `git reset --hard <이전 커밋 ID>` 후 재빌드/재시작.

### 3.2 DB 롤백 (필요 시)
코드를 롤백해도 DB 컬럼이 남아있어서 문제가 되지는 않습니다. 하지만 DB까지 원복해야 한다면 아래 SQL을 실행하세요.

```sql
-- Audit Log 컬럼 제거 (데이터 보존을 위해 신중히 실행)
ALTER TABLE public.audit_logs 
  DROP COLUMN IF EXISTS request_id,
  DROP COLUMN IF EXISTS route,
  DROP COLUMN IF EXISTS action_name,
  DROP COLUMN IF EXISTS entity_type,
  DROP COLUMN IF EXISTS metadata;

-- 트리거 원복 (기존 함수 백업이 있다면 복원, 없다면 현행 유지 권장)
```

---

## 4. 운영 주의사항

1.  **Multi-SKU 검수 제한**
    - 현재 프론트엔드 UI는 단일 상품 검수에 최적화되어 있습니다. 하나의 입고 건에 여러 상품(Line)이 있는 경우, 첫 번째 상품만 처리될 수 있으니 주의해 주세요. (Phase 3에서 UI 개선 예정)

2.  **Service Role 사용**
    - `audit_logs` 기록 등 일부 시스템 작업은 관리자 권한(Service Role)으로 실행됩니다. 감사 로그에 `user_id`가 명확히 남는지 주기적으로 확인해 주세요.

3.  **대량 업로드 제한**
    - 파일 업로드 기능 사용 시, 5MB 또는 1000행(Excel) 이상의 데이터는 타임아웃이 발생할 수 있습니다. 데이터를 분할하여 업로드해 주세요.
