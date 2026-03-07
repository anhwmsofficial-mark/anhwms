const baseUrl = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const timeoutMs = Number(process.env.SMOKE_READY_TIMEOUT_MS || '45000');
const pollIntervalMs = 1500;
const smokeBypassToken = (process.env.CI_SMOKE_BYPASS_TOKEN || '').trim();

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        ...(smokeBypassToken ? { 'x-ci-smoke-bypass': smokeBypassToken } : {}),
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchWithTimeout('/api/health');
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still booting.
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Smoke 대상 서버가 준비되지 않았습니다: ${baseUrl}`);
}

async function runCheck(check) {
  const response = await fetchWithTimeout(check.path, check.request);
  const contentType = response.headers.get('content-type') || '';
  const body =
    contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => '');

  if (!check.acceptedStatuses.includes(response.status)) {
    throw new Error(
      [
        `Smoke 실패: ${check.name}`,
        `path=${check.path}`,
        `status=${response.status}`,
        `accepted=${check.acceptedStatuses.join(',')}`,
        `body=${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`,
      ].join(' | '),
    );
  }

  if (check.assert) {
    check.assert({ response, body });
  }

  console.log(`PASS ${check.name}: ${response.status}`);
}

const checks = [
  {
    name: 'health route',
    path: '/api/health',
    acceptedStatuses: [200],
    assert: ({ body }) => {
      if (!body?.ok) {
        throw new Error('health 응답에 ok=true가 없습니다.');
      }
    },
  },
  {
    name: 'admin inbound-share validation',
    path: '/api/admin/inbound-share',
    acceptedStatuses: [400, 401, 403],
  },
  {
    name: 'admin volume-share validation',
    path: '/api/admin/inventory/volume/share',
    acceptedStatuses: [400, 401, 403],
  },
  {
    name: 'shared inbound validation',
    path: '/api/share/inbound',
    acceptedStatuses: [400],
  },
  {
    name: 'shared inventory validation',
    path: '/api/share/inventory',
    acceptedStatuses: [400],
  },
  {
    name: 'import staging health',
    path: '/api/health/import-staging',
    acceptedStatuses: [200],
  },
];

await waitForServer();

for (const check of checks) {
  await runCheck(check);
}

console.log('Smoke checks completed successfully.');
