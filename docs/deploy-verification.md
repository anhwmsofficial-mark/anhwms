# 배포 검증 가이드 (Deployment Verification)

배포(Deployment) 직후 시스템의 핵심 기능이 정상 동작하는지 확인하기 위한 자동화 스크립트 가이드입니다.

## 1. 개요

`npm run verify:deploy` 명령어는 데이터베이스 연결, 필수 테이블 접근 권한, 핵심 RPC 함수의 존재 여부를 **데이터 변경 없이(Read-Only/Dry-Run)** 검증합니다.

## 2. 실행 방법

터미널에서 아래 명령어를 실행하세요.

```bash
npm run verify:deploy
```

> **주의**: 실행 전 `.env` 또는 `.env.local` 파일에 `NEXT_PUBLIC_SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 올바르게 설정되어 있어야 합니다.

## 3. 검증 항목

스크립트는 다음 항목을 순차적으로 점검합니다.

1.  **Supabase Connection**: DB 연결 상태 확인
2.  **Table Access: inbound_receipts**: 입고 관련 테이블 조회 권한 확인
3.  **Table Access: inventory_ledger**: 재고 원장 테이블 조회 권한 확인
4.  **Table Access: audit_logs**: 감사 로그 테이블 접근 확인 (INSERT 테스트는 생략하고 READ 접근만 확인하여 안전성 확보)
5.  **RPC Check: confirm_inbound_receipt**: 입고 확정 함수 존재 여부 (Dummy 호출)
6.  **RPC Check: create_inbound_plan_full**: Phase 2 신규 트랜잭션 함수 존재 여부

## 4. 결과 해석

### 성공 (SAFE)

```
DEPLOY STATUS: SAFE
Core tables and RPCs are accessible.
```

모든 체크가 `✔ PASS`로 통과된 경우입니다. 시스템이 기본적으로 동작 가능한 상태입니다.

### 실패 (WARNING / FAIL)

```
DEPLOY STATUS: WARNING / FAIL
Possible causes: ...
```

하나 이상의 체크가 `✖ FAIL`된 경우입니다.

**주요 조치 방법:**
- **Environment Variables**: `SUPABASE_SERVICE_ROLE_KEY`가 맞는지 확인하세요.
- **Migrations**: `supabase/migrations/` 폴더의 최신 SQL 파일이 DB에 적용되었는지 확인하세요. (`create_inbound_plan_full` 함수가 없다는 에러가 발생하면 마이그레이션 누락일 가능성이 높습니다.)
- **RLS Policies**: Admin 권한으로 테이블 접근이 막혀 있는지 정책을 검토하세요.
