const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const middlewarePath = path.join(projectRoot, 'middleware.ts');
const legacyProxyPath = path.join(projectRoot, 'proxy.ts');

if (!fs.existsSync(middlewarePath)) {
  console.error('[middleware-guard] Missing root middleware.ts');
  process.exit(1);
}

const middlewareSource = fs.readFileSync(middlewarePath, 'utf8');
if (!/export\s+async\s+function\s+middleware\s*\(/.test(middlewareSource)) {
  console.error('[middleware-guard] middleware.ts must export middleware()');
  process.exit(1);
}

if (!/updateSession/.test(middlewareSource)) {
  console.error('[middleware-guard] middleware.ts should call updateSession()');
  process.exit(1);
}

if (fs.existsSync(legacyProxyPath)) {
  console.error('[middleware-guard] Obsolete proxy.ts found; use middleware.ts only');
  process.exit(1);
}

console.log('[middleware-guard] OK');
