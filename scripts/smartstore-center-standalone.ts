import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { readCommerceCredentials } from '../src/features/smartstore-detail/credentials';
import { createNaverCommerceClient } from '../src/features/smartstore-detail/naver';

const APP_VERSION = '1.0.0';
const PORT = 8787;
const APP_DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ANH_WMS');
const CONFIG_PATH = path.join(APP_DIR, 'smartstore-center-standalone.json');
const LOG_PATH = path.join(APP_DIR, 'smartstore-center.log');
const PID_PATH = path.join(APP_DIR, 'smartstore-center.pid');
const AGENT_PATH = path.join(APP_DIR, 'SmartstoreCenterAgent.exe');
const STARTUP_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup',
);
const STARTUP_PATH = path.join(STARTUP_DIR, 'ANH Smartstore Center.vbs');
const ALLOWED_ORIGINS = new Set([
  'https://anhwms.com',
  'https://www.anhwms.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

type StoredConfig = {
  clientId: string;
  encryptedClientSecret: string;
  installedAt: string;
  version: string;
};

function appendLog(message: string) {
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}\r\n`, 'utf8');
}

function powershell(script: string, input: string) {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { input, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || 'Windows 자격증명 암호화에 실패했습니다.').trim());
  }
  return String(result.stdout).trim();
}

function encryptSecret(secret: string) {
  return powershell(
    "$plain=[Console]::In.ReadToEnd(); $secure=ConvertTo-SecureString $plain -AsPlainText -Force; ConvertFrom-SecureString $secure",
    secret,
  );
}

function decryptSecret(encrypted: string) {
  return powershell(
    "$encrypted=[Console]::In.ReadToEnd(); $secure=ConvertTo-SecureString $encrypted; $credential=[System.Net.NetworkCredential]::new('', $secure); [Console]::Out.Write($credential.Password)",
    encrypted,
  );
}

function promptLine(label: string) {
  return new Promise<string>((resolve) => {
    process.stdout.write(label);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (value) => {
      process.stdin.pause();
      resolve(String(value).replace(/[\r\n]+$/, '').trim());
    });
  });
}

function promptSecret(label: string) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return promptLine(label);
  }
  return new Promise<string>((resolve, reject) => {
    let value = '';
    process.stdout.write(label);
    process.stdin.resume();
    process.stdin.setRawMode(true);
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) {
          cleanup();
          reject(new Error('설치를 취소했습니다.'));
          return;
        }
        if (byte === 13 || byte === 10) {
          cleanup();
          process.stdout.write('\r\n');
          resolve(value);
          return;
        }
        if (byte === 8 || byte === 127) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        const character = Buffer.from([byte]).toString('utf8');
        if (character.trim()) {
          value += character;
          process.stdout.write('*');
        }
      }
    };
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on('data', onData);
  });
}

function stopInstalledAgent() {
  if (!fs.existsSync(PID_PATH)) return;
  const pid = Number(fs.readFileSync(PID_PATH, 'utf8').trim());
  if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
    try {
      const executablePath = powershell(
        `$process=Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" -ErrorAction SilentlyContinue; if ($process) { [Console]::Out.Write($process.ExecutablePath) }`,
        '',
      );
      if (path.resolve(executablePath).toLowerCase() === path.resolve(AGENT_PATH).toLowerCase()) {
        process.kill(pid);
      }
    } catch {
      // A stale PID is harmless.
    }
  }
  try {
    fs.unlinkSync(PID_PATH);
  } catch {
    // The old agent may already have removed it.
  }
}

function writeStartupLauncher() {
  fs.mkdirSync(STARTUP_DIR, { recursive: true });
  const legacyShortcut = path.join(STARTUP_DIR, 'ANH Smartstore Center.lnk');
  try {
    fs.unlinkSync(legacyShortcut);
  } catch {
    // The legacy shortcut may not exist.
  }
  const escapedPath = AGENT_PATH.replaceAll('"', '""');
  const script = [
    'Set shell = CreateObject("WScript.Shell")',
    `shell.Run Chr(34) & "${escapedPath}" & Chr(34) & " --agent", 0, False`,
    '',
  ].join('\r\n');
  fs.writeFileSync(STARTUP_PATH, script, 'utf8');
}

function launchInstalledAgent() {
  const child = spawn(AGENT_PATH, ['--agent'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function readAgentHealth() {
  return new Promise<{ version?: string }>((resolve, reject) => {
    const request = http.get(`http://127.0.0.1:${PORT}/health`, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as { version?: string });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(5000, () => request.destroy(new Error('연결 확인 시간이 초과되었습니다.')));
    request.on('error', reject);
  });
}

async function waitForInstalledAgent() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const health = await readAgentHealth();
      if (health.version === APP_VERSION) return;
      throw new Error('이전 연결 프로그램이 아직 실행 중입니다.');
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `센터 연결 프로그램을 시작하지 못했습니다. 기존 PowerShell 연결 창을 닫고 설치 파일을 다시 실행하세요. (${lastError instanceof Error ? lastError.message : '연결 실패'})`,
  );
}

async function install() {
  if (process.platform !== 'win32') {
    throw new Error('이 설치 파일은 Windows 전용입니다.');
  }
  console.log('');
  console.log(`ANH 스마트스토어 센터 연결 설치 v${APP_VERSION}`);
  console.log('네이버에서 새로 발급한 값을 입력하세요.');
  console.log('');

  const clientId = await promptLine('애플리케이션 ID: ');
  if (!clientId) throw new Error('애플리케이션 ID가 필요합니다.');
  const clientSecret = await promptSecret('애플리케이션 시크릿: ');
  if (!clientSecret) throw new Error('애플리케이션 시크릿이 필요합니다.');

  fs.mkdirSync(APP_DIR, { recursive: true });
  const config: StoredConfig = {
    clientId,
    encryptedClientSecret: encryptSecret(clientSecret),
    installedAt: new Date().toISOString(),
    version: APP_VERSION,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

  stopInstalledAgent();
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (path.resolve(process.execPath).toLowerCase() !== path.resolve(AGENT_PATH).toLowerCase()) {
    fs.copyFileSync(process.execPath, AGENT_PATH);
  }
  writeStartupLauncher();
  launchInstalledAgent();
  await waitForInstalledAgent();

  console.log('');
  console.log('설치가 완료되었습니다.');
  console.log('이후 Windows 로그인 시 자동으로 연결되며 작업자는 WMS 화면만 사용하면 됩니다.');
  console.log(`로그 위치: ${LOG_PATH}`);
  console.log('');
  await promptLine('Enter를 누르면 닫힙니다.');
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function applyCors(req: http.IncomingMessage, res: http.ServerResponse) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req: http.IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 2_000_000) {
        reject(new Error('요청이 너무 큽니다.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function startAgent() {
  fs.mkdirSync(APP_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) throw new Error('설치 정보가 없습니다. 설치 파일을 다시 실행하세요.');
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as StoredConfig;
  process.env.NAVER_COMMERCE_CLIENT_ID = config.clientId;
  process.env.NAVER_COMMERCE_CLIENT_SECRET = decryptSecret(config.encryptedClientSecret);
  const credentials = readCommerceCredentials();
  const client = createNaverCommerceClient({ credentials });

  fs.writeFileSync(PID_PATH, String(process.pid), 'utf8');
  process.on('exit', () => {
    try {
      if (fs.readFileSync(PID_PATH, 'utf8').trim() === String(process.pid)) fs.unlinkSync(PID_PATH);
    } catch {
      // Ignore cleanup failures during Windows shutdown.
    }
  });
  process.on('uncaughtException', (error) => {
    appendLog(`치명적 오류: ${error.message}`);
    process.exit(1);
  });
  process.on('unhandledRejection', (error) => {
    appendLog(`처리되지 않은 오류: ${error instanceof Error ? error.message : String(error)}`);
  });

  const server = http.createServer(async (req, res) => {
    applyCors(req, res);
    const origin = req.headers.origin || '';
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      send(res, 403, { ok: false, message: '허용되지 않은 WMS 화면에서 요청했습니다.' });
      return;
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', 'http://127.0.0.1');
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        try {
          await client.diagnose();
          send(res, 200, { ok: true, configured: true, version: APP_VERSION });
        } catch (error) {
          const message = error instanceof Error ? error.message : '네이버 연결 진단에 실패했습니다.';
          send(res, 200, { ok: false, configured: true, message, version: APP_VERSION });
        }
        return;
      }
      if (req.method === 'POST' && url.pathname === '/apply') {
        if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
          send(res, 415, { ok: false, message: 'JSON 요청만 허용됩니다.' });
          return;
        }
        const payload = JSON.parse(await readBody(req)) as { channelProductNo?: string; html?: string };
        const updated = await client.updateDetailContent(
          String(payload.channelProductNo || ''),
          String(payload.html || ''),
        );
        send(res, 200, { ok: true, beforeHtml: updated.beforeHtml });
        return;
      }
      send(res, 404, { ok: false, message: '없는 주소입니다.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '센터 PC에서 네이버 호출에 실패했습니다.';
      appendLog(`API 오류: ${message}`);
      send(res, 502, { ok: false, message });
    }
  });

  server.on('error', (error) => {
    appendLog(`서버 시작 오류: ${error.message}`);
    process.exit(1);
  });
  server.listen(PORT, '127.0.0.1', () => {
    appendLog(`센터 연결 프로그램 v${APP_VERSION} 시작 (127.0.0.1:${PORT})`);
  });
}

async function main() {
  try {
    if (process.argv.includes('--self-test')) {
      const sample = `test-${Date.now()}-$`;
      if (decryptSecret(encryptSecret(sample)) !== sample) {
        throw new Error('Windows 자격증명 암호화 자체 검사에 실패했습니다.');
      }
      console.log('SmartstoreCenterSetup self-test OK');
    } else if (process.argv.includes('--version')) {
      console.log(`SmartstoreCenterSetup ${APP_VERSION}`);
    } else if (process.argv.includes('--agent')) {
      await startAgent();
    } else {
      await install();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendLog(`실행 오류: ${message}`);
    console.error(`오류: ${message}`);
    if (!process.argv.includes('--agent')) await promptLine('Enter를 누르면 닫힙니다.');
    process.exitCode = 1;
  }
}

void main();
