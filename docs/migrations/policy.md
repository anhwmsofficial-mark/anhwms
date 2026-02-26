# Migration Policy (Post-Baseline)

## 목적
- 환경별 스키마 불일치 방지
- 운영 재현성 확보
- 마이그레이션 경로 단일화로 운영 복잡도 축소

## 현재 기준
- 활성 마이그레이션 경로는 `supabase/migrations`만 사용한다.
- 파일명은 `YYYYMMDDHHMMSS_description.sql` 형식을 사용한다.
- 설명(description)은 소문자 snake_case만 허용한다.
- `migrations/*.sql`은 더 이상 활성 경로가 아니며, `migrations/_archive`는 보관 전용이다.

## 작성 규칙
- 신규 DB 변경은 항상 새 타임스탬프 파일로 추가한다.
- 이미 적용된 마이그레이션 파일은 수정하지 않는다.
- 정정이 필요하면 새 마이그레이션으로 보완한다.
- 롤백/재실행 안전성(idempotent)을 고려한다.

## 자동 검증
- 로컬:
  - `npm run check:migrations`
  - `npm run check:migration-filenames`
- CI:
  - `.github/workflows/migration-path-policy.yml`
- PR 체크리스트:
  - `.github/pull_request_template.md`

## 운영 원칙
- baseline/history 전환 작업은 `scripts/cutover-baseline-history.js` 경로만 사용한다.
- 레거시 파일 아카이브는 `scripts/archive-legacy-migrations.js`로 수행한다.
- 운영 히스토리 변경은 사전 백업 및 롤백 계획 확인 후 진행한다.

## 체크리스트
- [ ] 신규 SQL 파일이 `supabase/migrations` 아래에만 추가되었는가?
- [ ] 파일명이 `YYYYMMDDHHMMSS_description.sql` 형식인가?
- [ ] `migrations/` 루트에 신규 SQL 파일이 추가되지 않았는가?
- [ ] 롤백/재실행 안전성(`IF NOT EXISTS` 등)을 검토했는가?
