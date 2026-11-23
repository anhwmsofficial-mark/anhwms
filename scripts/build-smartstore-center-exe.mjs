import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  throw new Error('SmartstoreCenterSetup.exe는 Windows에서만 빌드할 수 있습니다.');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, '.smartstore-center-build');
const releaseDir = path.join(root, 'release');
const bundlePath = path.join(buildDir, 'smartstore-center.cjs');
const blobPath = path.join(buildDir, 'smartstore-center.blob');
const configPath = path.join(buildDir, 'sea-config.json');
const exePath = path.join(releaseDir, 'SmartstoreCenterSetup.exe');
const esbuild = path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
const postject = path.join(root, 'node_modules', 'postject', 'dist', 'cli.js');

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(releaseDir, { recursive: true });
fs.rmSync(exePath, { force: true });

console.log('1/5 TypeScript와 의존성을 단일 스크립트로 묶습니다.');
execFileSync(
  process.execPath,
  [
    esbuild,
    'scripts/smartstore-center-standalone.ts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--target=node20',
    `--outfile=${bundlePath}`,
  ],
  { cwd: root, stdio: 'inherit' },
);

console.log('2/5 Node SEA 준비 파일을 생성합니다.');
fs.writeFileSync(
  configPath,
  JSON.stringify({
    main: bundlePath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
  }, null, 2),
  'utf8',
);
execFileSync(process.execPath, ['--experimental-sea-config', configPath], { cwd: root, stdio: 'inherit' });

console.log('3/5 Windows 실행 파일을 준비합니다.');
fs.copyFileSync(process.execPath, exePath);
try {
  execFileSync('signtool.exe', ['remove', '/s', exePath], { stdio: 'ignore' });
} catch {
  console.log('   signtool을 찾지 못해 기존 서명 제거를 건너뜁니다.');
}

console.log('4/5 센터 연결 프로그램을 실행 파일에 삽입합니다.');
execFileSync(
  process.execPath,
  [
    postject,
    exePath,
    'NODE_SEA_BLOB',
    blobPath,
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ],
  { cwd: root, stdio: 'inherit' },
);

console.log('5/5 실행 파일을 검증합니다.');
const version = execFileSync(exePath, ['--version'], { encoding: 'utf8', windowsHide: true }).trim();
if (version !== 'SmartstoreCenterSetup 1.0.0') {
  throw new Error(`실행 파일 자체 검사 실패: ${version || '출력 없음'}`);
}
const selfTest = execFileSync(exePath, ['--self-test'], { encoding: 'utf8', windowsHide: true }).trim();
if (selfTest !== 'SmartstoreCenterSetup self-test OK') {
  throw new Error(`Windows 암호화 자체 검사 실패: ${selfTest || '출력 없음'}`);
}

const stat = fs.statSync(exePath);
console.log(`완료: ${exePath}`);
console.log(`크기: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
