import http from 'node:http';
import { readCommerceCredentials } from '../src/features/smartstore-detail/credentials';
import { createNaverCommerceClient } from '../src/features/smartstore-detail/naver';

const PORT = 8787;
const ALLOWED_ORIGINS = new Set([
  'https://www.anhwms.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

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

const credentials = readCommerceCredentials();
const client = createNaverCommerceClient({ credentials: credentials.configured ? credentials : null });

const server = http.createServer(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, { ok: true, configured: credentials.configured });
      return;
    }
    if (!credentials.configured) {
      send(res, 409, { ok: false, message: '이 PC에 네이버 API 키가 없습니다.' });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/diagnose') {
      await client.diagnose();
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/apply') {
      const payload = JSON.parse(await readBody(req)) as { channelProductNo?: string; html?: string };
      const updated = await client.updateDetailContent(String(payload.channelProductNo || ''), String(payload.html || ''));
      send(res, 200, { ok: true, beforeHtml: updated.beforeHtml });
      return;
    }
    send(res, 404, { ok: false, message: '없는 주소입니다.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '센터 PC에서 네이버 호출에 실패했습니다.';
    send(res, 502, { ok: false, message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`스마트스토어 센터 연결 프로그램이 http://127.0.0.1:${PORT} 에서 실행 중입니다.`);
});
