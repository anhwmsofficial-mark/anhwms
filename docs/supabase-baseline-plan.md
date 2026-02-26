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

## Phase 3 (cutover): History switch after pilot success
1. Back up production DB and migration history.
2. Mark old migration versions as reverted in target environment using `supabase migration repair`.
3. Mark baseline version as applied.
4. Keep post-baseline migrations as incremental timestamp files.

## Rules after cutover
- Use `supabase/migrations` as the only active migration path.
- Keep `migrations/` as legacy reference until final retirement.
- Never rewrite production migration history without backup + explicit rollback plan.

