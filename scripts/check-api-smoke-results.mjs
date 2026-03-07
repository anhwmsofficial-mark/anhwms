import fs from 'node:fs';
import path from 'node:path';

const reportPathArg = process.argv[2];
const reportPath = reportPathArg
  ? path.resolve(reportPathArg)
  : path.resolve('test-results/api-smoke/api-smoke-results.json');

function fail(message, details = []) {
  console.error(`[api-smoke-guard] ${message}`);
  for (const line of details) {
    console.error(`[api-smoke-guard] ${line}`);
  }
  process.exit(1);
}

if (!fs.existsSync(reportPath)) {
  fail('Playwright JSON 결과 파일을 찾을 수 없습니다.', [
    `expected_report=${reportPath}`,
    'API smoke tests 단계가 실행되지 않았거나 reporter 출력이 생성되지 않았습니다.',
  ]);
}

const raw = fs.readFileSync(reportPath, 'utf8');
let report;
try {
  report = JSON.parse(raw);
} catch (error) {
  fail('Playwright JSON 결과 파싱에 실패했습니다.', [
    `expected_report=${reportPath}`,
    `error=${error instanceof Error ? error.message : String(error)}`,
  ]);
}

const flattened = [];

function walkSuite(suite, parents = []) {
  const nextParents = suite.title ? [...parents, suite.title] : parents;

  for (const spec of suite.specs || []) {
    const specPath = [...nextParents, spec.title].filter(Boolean);
    for (const test of spec.tests || []) {
      const results = Array.isArray(test.results) ? test.results : [];
      const finalResult = results[results.length - 1] || {};
      const status = finalResult.status || test.status || 'unknown';
      flattened.push({
        titlePath: [...specPath, test.title].filter(Boolean),
        status,
      });
    }
  }

  for (const child of suite.suites || []) {
    walkSuite(child, nextParents);
  }
}

for (const suite of report.suites || []) {
  walkSuite(suite, []);
}

const total = flattened.length;
const skipped = flattened.filter((item) => item.status === 'skipped');
const passed = flattened.filter((item) => item.status === 'passed');
const failed = flattened.filter((item) => item.status === 'failed' || item.status === 'timedOut');
const executed = flattened.filter((item) => item.status !== 'skipped');
const healthTest = flattened.find((item) => item.titlePath.join(' > ').includes('/api/health 가 응답한다'));

console.log('[api-smoke-guard] summary');
console.log(`[api-smoke-guard] report=${reportPath}`);
console.log(`[api-smoke-guard] total=${total} passed=${passed.length} failed=${failed.length} skipped=${skipped.length}`);

if (total === 0) {
  fail('실행된 smoke test가 0건입니다.', [
    'Playwright 테스트 수집이 실패했거나 잘못된 test path가 전달되었습니다.',
  ]);
}

if (executed.length === 0) {
  fail('모든 smoke test가 skipped 처리되었습니다.', [
    '최소 1개 이상의 의미 있는 smoke 검증이 실행되어야 합니다.',
    'CI secrets 또는 smoke bypass token 설정을 확인하세요.',
  ]);
}

if (!healthTest) {
  fail('/api/health smoke test를 결과에서 찾을 수 없습니다.', [
    'tests/api/health.spec.ts 내 /api/health 케이스가 누락되었는지 확인하세요.',
  ]);
}

if (healthTest.status === 'skipped') {
  fail('/api/health smoke test가 skipped 처리되었습니다.', [
    'CI에서는 최소 health smoke 1개가 반드시 실행되어야 합니다.',
    'CI_SMOKE_BYPASS_TOKEN 주입 여부와 middleware bypass 조건을 확인하세요.',
  ]);
}

if (failed.length > 0) {
  fail('실패한 smoke test가 있습니다.', failed.map((item) => `${item.status}: ${item.titlePath.join(' > ')}`));
}

console.log('[api-smoke-guard] API smoke result validation passed');
