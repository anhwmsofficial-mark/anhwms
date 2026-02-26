# Migration Governance (단일 경로 운영)

## 결론
- 마이그레이션 실행 기준 경로는 `supabase/migrations` 하나로 통일합니다.
- `migrations`는 레거시/참고용으로만 유지하고, 신규 SQL 추가는 금지합니다.
- 운영 DB 이력이 있는 상태에서는 전체 단일 SQL 스쿼시보다 `baseline + 증분` 전략을 권장합니다.

## 현재 상태 요약
- `migrations/*.sql`: 다수의 레거시/수동 적용 스크립트가 존재
- `supabase/migrations/*.sql`: Supabase CLI 기준 timestamp 마이그레이션 존재
- 두 경로가 동시에 사용되면 적용 순서/재현성/온보딩 안정성이 떨어집니다.

## 운영 원칙
1. 신규 마이그레이션은 `supabase/migrations`에만 생성
2. 파일명은 Supabase timestamp 규칙 사용 (`YYYYMMDDHHMMSS_description.sql`)
3. PR 리뷰 시 `migrations/*.sql` 신규 파일은 반려
4. 문서/가이드/CI 모두 `supabase/migrations` 기준으로 통일

## 자동 가드
- 로컬 점검: `npm run check:migrations`
- CI 점검: `.github/workflows/migration-path-policy.yml`
- 예외: `migrations/_archive/*.sql` 이동은 허용

## 매핑(참고)
아래는 최근 이력 기준으로 확인된 대응 관계입니다.

- `migrations/125_fix_supabase_security_lints.sql` ↔ `supabase/migrations/20260225123000_fix_supabase_security_lints.sql`
- `migrations/127_harden_rls_and_function_search_path.sql` ↔ `supabase/migrations/20260225153000_harden_rls_and_function_search_path.sql`
- `migrations/127_fix_advisor_perf_rls.sql` ↔ `supabase/migrations/20260225160000_fix_advisor_perf_rls.sql`
- `migrations/130_fix_multiple_permissive_update_policies.sql` ↔ `supabase/migrations/20260225170000_fix_multiple_permissive_update_policies.sql`
- `migrations/131_normalize_auth_rls_initplan_safe.sql` ↔ `supabase/migrations/20260225173000_normalize_auth_rls_initplan_safe.sql`
- `migrations/132_drop_redundant_permissive_policies_safe.sql` ↔ `supabase/migrations/20260225180000_drop_redundant_permissive_policies_safe.sql`
- `migrations/133_drop_redundant_policies_role_superset.sql` ↔ `supabase/migrations/20260225183000_drop_redundant_policies_role_superset.sql`
- `migrations/134_normalize_auth_and_drop_dominated_true_policies.sql` ↔ `supabase/migrations/20260225190000_normalize_auth_and_drop_dominated_true_policies.sql`
- `migrations/135_drop_obviously_redundant_policy_sets.sql` ↔ `supabase/migrations/20260225193000_drop_obviously_redundant_policy_sets.sql`
- `migrations/136_targeted_policy_consolidation_stage.sql` ↔ `supabase/migrations/20260225200000_targeted_policy_consolidation_stage.sql`
- `migrations/137_merge_users_policies_by_role_action.sql` ↔ `supabase/migrations/20260225203000_merge_users_policies_by_role_action.sql`
- `migrations/138_finalize_last_three_policy_warnings.sql` ↔ `supabase/migrations/20260225210000_finalize_last_three_policy_warnings.sql`
- `migrations/139_query_performance_hotfix_notifications.sql` ↔ `supabase/migrations/20260225213000_query_performance_hotfix_notifications.sql`

## 전환 단계 (안전 순서)
### 1단계: 정책 고정 (지금)
- 단일 경로 정책 문서화
- 팀 공지: 신규는 `supabase/migrations`만 사용

### 2단계: 레거시 정리 (권장)
- 대응이 끝난 `migrations` 파일은 즉시 삭제하지 말고 `migrations/_archive`로 이동
- 최소 1~2 스프린트 관찰 후 완전 제거 여부 결정

### 3단계: Baseline (선택)
- 새 환경 부팅 속도/단순화를 위해 baseline SQL 1개 생성
- 기존 운영 환경은 기존 히스토리 유지, 신규 환경은 baseline + 이후 증분 적용

## 하지 않을 것
- 운영 중 DB에서 과거 마이그레이션 히스토리를 임의 재작성
- 이미 배포된 이력을 단일 파일로 즉시 스쿼시 후 강제 전환

