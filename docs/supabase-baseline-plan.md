# Supabase Baseline Transition Plan

## Why this plan exists
- Current remote migration history is healthy and fully synchronized with local `supabase/migrations`.
- A direct `supabase migration squash --linked` failed because earliest migration scripts are not cleanly replayable from an empty DB.
- To avoid breaking production history, baseline adoption must be done in controlled phases.

## Current verified state
- Remote migrations applied through `20260225220000`.
- New schema snapshot baseline file created:
  - `supabase/migrations/20260226220000_baseline_schema.sql`

## Phase 1 (completed): Stabilization
1. Reverted risky migration-path restructuring commits.
2. Pushed missing remote migrations with `supabase db push`.
3. Verified local/remote migration parity via `supabase migration list`.

## Phase 2 (next): Baseline pilot on a fresh environment
1. Create a clean database (new Supabase branch/project).
2. Apply only `20260226220000_baseline_schema.sql`.
3. Run smoke tests for critical features:
   - auth / user_profiles
   - notifications
   - CS translate / glossary endpoints
4. Compare schema diff against production.

### Pilot status (2026-02-26)
- Preview branches created:
  - `baseline-pilot-20260226` (first attempt, CLI prepared statement issue)
  - `baseline-pilot2-20260226` (validated)
- Baseline apply result on `baseline-pilot2-20260226`: success
- Smoke checks passed:
  - `public.user_profiles` exists
  - `public.notifications` exists
- Baseline file was updated to pre-create required extension objects:
  - `CREATE SCHEMA IF NOT EXISTS extensions`
  - `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions`
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions`

## Phase 3 (cutover): History switch after pilot success
1. Back up production DB and migration history.
2. Mark old migration versions as reverted in target environment using `supabase migration repair`.
3. Mark baseline version as applied.
4. Keep post-baseline migrations as incremental timestamp files.

### Automated cutover script
- Script: `scripts/cutover-baseline-history.js`
- Safe default: dry-run only (no changes)
- Package scripts:
  - `npm run cutover:baseline:dry`
  - `npm run cutover:baseline:apply`
  - `npm run cutover:baseline:rollback`

Recommended run order on production:
1. `npm run cutover:baseline:dry`
2. Confirm backup/snapshot is complete
3. `npm run cutover:baseline:apply`
4. Verify with `npx supabase migration list`

## Rules after cutover
- Use `supabase/migrations` as the only active migration path.
- Keep `migrations/` as legacy reference until final retirement.
- Never rewrite production migration history without backup + explicit rollback plan.

