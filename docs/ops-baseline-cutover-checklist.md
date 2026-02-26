# Ops Checklist: Baseline Cutover

## Current baseline state
- Active remote migration history: `20260226220000` only
- Previous migration versions (`20260225123000` ~ `20260225220000`) are reverted in history
- Main service URL: `https://www.anhwms.com`

## Daily quick health checks
1. Public routes
   - `GET /` -> 200
   - `GET /robots.txt` -> 200
   - `GET /sitemap.xml` -> 200
2. Authenticated API smoke (admin user token required)
   - `GET /api/orders?limit=1` -> 200
   - `GET /api/notifications` -> 200
   - `POST /api/cs/translate` -> 200
   - `POST /api/cs` -> 200 (when provided, `partnerId` must be `partners.id` UUID)

## Baseline operations
### Dry-run (safe)
```bash
npm run cutover:baseline:dry
```

### Apply cutover history
```bash
npm run cutover:baseline:apply
```

### Rollback cutover history
```bash
npm run cutover:baseline:rollback
```

## Recovery guide (if API failures appear)
1. Check migration history first:
```bash
npx supabase migration list
```
2. If baseline state is broken, run rollback:
```bash
npm run cutover:baseline:rollback
```
3. Verify core APIs with authenticated token.
4. If needed, re-apply:
```bash
npm run cutover:baseline:apply
```

## Security and access notes
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to client/browser.
- API auth checks now rely on request context (`Bearer` token support fixed).
- For incident debugging, prioritize:
  1) auth token validity
  2) `user_profiles` role/status
  3) RLS policy errors in API logs

## Ownership handoff
- DB migration owner: Platform/Backend
- API smoke owner: Backend
- SEO/robots/sitemap owner: Frontend/Web

