# Middleware Security Hardening Plan

## Background
- Admin and operations access control logic exists in `utils/supabase/middleware.ts`.
- Next.js only executes middleware from the root `middleware.ts` entrypoint.
- Because the root entrypoint was missing, URL-level protection did not run for page navigation.

## Risk Summary
- Unauthenticated users could directly open protected UI routes such as `/admin`, `/users`, `/operations`, `/ops`.
- Data APIs were still partially protected by API checks and RLS, but UI exposure and workflow leakage remained possible.
- This is a defense-in-depth gap and should be treated as a critical issue.

## Implemented Fix
1. Added root `middleware.ts` to invoke `updateSession()` from `utils/supabase/middleware.ts`.
2. Removed obsolete `proxy.ts` file to eliminate confusion about runtime entrypoints.
3. Kept matcher policy aligned with existing protected/static exclusions.

## Access Policy Design (Current)
- **Protected pages**: `/admin`, `/dashboard`, `/inventory`, `/inbound`, `/outbound`, `/orders`, `/management`, `/operations`, `/settings`, `/ops`, portal paths.
- **Admin-only pages**: `/admin`, `/users`, `/ops` (except `/admin/env-check`).
- **Public APIs** remain explicitly allowlisted in middleware.
- Non-authenticated users are redirected to `/login?next=<path>`.
- Non-authorized users are redirected to `/dashboard` (or API 403/401).

## Rollout Checklist
1. Deploy middleware change.
2. Validate anonymous access:
   - `/users` -> redirect to `/login`
   - `/admin` -> redirect to `/login`
   - `/operations/field-check` -> redirect to `/login`
3. Validate authenticated non-admin access:
   - `/admin` and `/users` -> redirect to `/dashboard`
4. Validate admin access:
   - `/admin`, `/users`, `/ops/*` accessible.
5. Validate API behavior:
   - `/api/admin/*` returns 401/403 when unauthorized.

## Follow-up Improvements
- Add Playwright e2e security spec for anonymous/admin/non-admin route access matrix.
- Add structured security logs for middleware denials (path, reason, role).
- Add CI check to fail if root `middleware.ts` is removed.

## Test Runtime Notes
- New e2e files:
  - `tests/e2e/middleware-guard.spec.ts` (anonymous guard checks)
  - `tests/e2e/role-access-matrix.spec.ts` (staff/admin role checks)
- Role matrix tests require env vars:
  - `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`
  - `E2E_STAFF_EMAIL`, `E2E_STAFF_PASSWORD`
