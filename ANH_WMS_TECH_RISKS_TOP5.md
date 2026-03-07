# ANH WMS 핵심 기술 리스크 Top 5

기준일: 2026-03-07  
기준: 현재 코드/문서 상태, 운영 안정화 이후 실제로 남아 있는 리스크만 선별

## 선정 원칙
- 이미 해결된 항목은 제외
- 과장하지 않고 실제 코드 근거가 있는 항목만 포함
- 운영 사고 가능성과 향후 확장 저해 정도를 함께 반영

---

## 1. 레거시 `inbounds` 모델 잔존으로 인한 이중 모델 리스크

- 리스크 설명:
  - 입고 검수/확정의 주 경로는 `inbound_receipts` 중심으로 정리되었지만, 일부 조회/대시보드/함수는 아직 `inbounds` 테이블을 사용합니다.
  - 동일 도메인에 `inbounds`와 `inbound_receipts`가 공존하면서 지표 불일치, 운영 혼선, 신규 기능 개발 시 잘못된 테이블 참조 가능성이 남아 있습니다.
- 현재 영향도: 높음
  - 대시보드 수치, 레거시 화면, Edge Function이 다른 기준을 볼 수 있음
- 발생 가능성: 높음
  - 이미 코드상 잔존 사용처가 확인됨
- 우선순위: P1
- 권장 대응 시점: 이번 달 안
- 관련 파일/모듈:
  - `lib/api/inbounds.ts`
  - `lib/api/dashboard.ts`
  - `supabase/functions/inbound-status/index.ts`
  - `app/api/inbound/[id]/route.ts`
  - `services/inbound/inboundService.ts`

## 2. Service Role 사용 구간 잔존으로 인한 권한 우회/테넌트 경계 리스크

- 리스크 설명:
  - `createTrackedAdminClient` 도입으로 추적성은 좋아졌지만, Service Role 자체는 여전히 여러 API/공유/크론 경로에서 사용 중입니다.
  - 현재는 "사용 감시" 단계이지 "제거 완료" 단계가 아니므로, 권한 체크 누락이나 org/tenant 조건 누락 시 RLS를 우회할 가능성이 남아 있습니다.
- 현재 영향도: 높음
  - 잘못 사용되면 데이터 범위를 직접 우회할 수 있음
- 발생 가능성: 중간
  - 추적은 되지만, 남은 사용처 수가 적지 않음
- 우선순위: P1
- 권장 대응 시점: 이번 달 안부터 점진 축소, 다음 분기까지 정리
- 관련 파일/모듈:
  - `utils/supabase/admin-client.ts`
  - `lib/supabase-admin.ts`
  - `lib/server/admin-ownership.ts`
  - `app/api/share/inventory/route.ts`
  - `app/api/share/inbound/route.ts`
  - `app/api/cron/alerts/route.ts`
  - `ADMIN_CLIENT_AUDIT.md`

## 3. 대량 업로드의 비동기/큐 구조 부재

- 리스크 설명:
  - 재고 staging 업로드는 검증과 적재가 HTTP 요청 안에서 순차 수행되는 구조입니다.
  - 현재는 `dryRun`, `limit`, `inventory_import_runs`로 운영 보조 장치는 있지만, "접수 -> 처리중 -> 완료/실패" 식의 비동기 job 구조는 아닙니다.
  - 파일 크기/행 수 제한으로 당장 통제는 가능하지만, 대량 데이터·느린 DB·동시 업로드 시 운영 병목이 남아 있습니다.
- 현재 영향도: 높음
  - 대량 업로드 요구가 늘면 타임아웃/재시도/부분 실패 대응이 어려움
- 발생 가능성: 중간~높음
  - 운영 볼륨 증가 시 바로 드러날 가능성이 큼
- 우선순위: P1
- 권장 대응 시점: 다음 분기 설계 착수, 이번 달에는 아키텍처 결정
- 관련 파일/모듈:
  - `app/api/admin/inventory/import-staging/upload-file/route.ts`
  - `app/api/admin/inventory/import-staging/route.ts`
  - `inventory_ledger_staging`
  - `inventory_import_runs`

## 4. 감사 로그/이벤트 로그의 트랜잭션 분리로 인한 누락 가능성

- 리스크 설명:
  - 주요 변경 작업 후 `logAudit` 또는 `logActivity`가 별도 insert로 실행되며, 실패 시 조용히 삼키거나 콘솔 에러만 남기는 경로가 있습니다.
  - 즉, 비즈니스 변경은 성공했는데 감사 로그는 빠지는 경우가 가능하며, 반대로 로그 구조가 두 가지(`utils/audit.ts`, `lib/audit-logger.ts`)로 나뉘어 있어 일관성도 떨어집니다.
- 현재 영향도: 중간~높음
  - 사고 분석, 추적, 컴플라이언스 대응 시 정보 공백이 생길 수 있음
- 발생 가능성: 중간
  - 로그 실패를 기능에 영향 주지 않도록 설계한 대신, 무결성 보장은 약함
- 우선순위: P2
- 권장 대응 시점: 이번 달 설계, 다음 분기 정비
- 관련 파일/모듈:
  - `utils/audit.ts`
  - `lib/audit-logger.ts`
  - `services/inbound/inboundService.ts`
  - `app/api/admin/audit-logs/route.ts`
  - `supabase/migrations/20260307150000_audit_log_v2.sql`

## 5. CI smoke 검증력의 secrets 의존성

- 리스크 설명:
  - smoke 전용 경로와 "all-skip 방지 가드"는 마련되었지만, 실질 검증력은 CI secrets 구성 수준에 따라 달라집니다.
  - 현재 기준상 `/api/health`만 실행되고 입고/audit/RPC/ledger 검증이 skip 되어도 CI는 통과할 수 있습니다.
  - 즉, 형식상 green은 방지했지만, 운영 핵심 경로 검증은 여전히 환경 구성에 의존합니다.
- 현재 영향도: 중간
  - 배포 직전 회귀를 일부 놓칠 수 있음
- 발생 가능성: 중간~높음
  - 신규 환경/브랜치/포크에서 secrets 미구성 상태가 흔함
- 우선순위: P2
- 권장 대응 시점: 이번 달 안
- 관련 파일/모듈:
  - `tests/api/health.spec.ts`
  - `tests/api/inbound-confirm.spec.ts`
  - `.github/workflows/ci.yml`
  - `scripts/check-api-smoke-results.mjs`
  - `API_SMOKE_TESTS.md`

---

## 이번 달 안에 할 것

1. `inbounds` 사용처를 전수 제거하고 입고 도메인 기준을 `inbound_receipts`로 단일화
2. Service Role 사용처를 route/action 단위로 분류하고, RLS 또는 `security definer` RPC 전환 우선순위 확정
3. CI secrets 권장 구성을 실제 저장소에 반영해 `/api/inbound/[id]`, `/api/admin/audit-logs`, RPC, ledger smoke가 최소 한 번은 돌도록 만들기
4. 감사 로그 모듈을 한 계층으로 정리하고, 최소한 핵심 도메인 변경(`inbound`, `inventory`, `orders`)은 동일 포맷으로 적재되도록 통일

## 다음 분기에 할 것

1. 대량 업로드를 queue/job 구조로 전환
2. 감사 로그와 이벤트 로그를 트랜잭션 또는 outbox 패턴 기반으로 정비
3. Service Role 제거 후보를 실제로 줄이고, 공유/크론/다운로드 경로를 목적별 보안 모델로 재설계
4. smoke를 넘어서는 실데이터 없는 통합 테스트 시나리오를 보강해 secrets 의존도를 완화

---

## 요약

현재 ANH WMS는 입고 검수의 즉시 사고 리스크는 상당 부분 줄였지만, 아직 다음 5개가 핵심 기술 리스크로 남아 있습니다.

1. 레거시 `inbounds` 모델 잔존
2. Service Role 사용 구간 잔존
3. 대량 업로드 비동기 구조 부재
4. 감사 로그/이벤트 로그의 트랜잭션 분리
5. CI smoke 검증력의 secrets 의존성

실무 우선순위 기준으로는 **이번 달 안에는 모델 단일화 + Service Role 축소 계획 + CI secrets 보강**, 다음 분기에는 **업로드 비동기화와 로그 아키텍처 정비**가 적절합니다.
