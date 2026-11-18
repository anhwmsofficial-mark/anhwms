import { hashSync } from 'bcryptjs';
import { assertSafeDetailHtml } from './html';

const API_BASE = 'https://api.commerce.naver.com/external';

export class CommerceCredentialsError extends Error {
  constructor() {
    super('네이버 커머스 API 자격증명이 없습니다. 연결 진단의 발급 절차를 먼저 완료해 주세요.');
    this.name = 'CommerceCredentialsError';
  }
}

export class NaverCommerceError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'NaverCommerceError';
    this.status = status;
  }
}

export type CommerceCredentialsInput = {
  clientId: string;
  clientSecret: string;
};

type FetchLike = typeof fetch;

export function createClientSecretSign(clientId: string, clientSecret: string, timestamp: number) {
  const hashed = hashSync(`${clientId}_${timestamp}`, clientSecret);
  return Buffer.from(hashed, 'utf8').toString('base64');
}

export function sanitizeApiError(status: number, body: string) {
  const redacted = body.replace(/client_secret(?:_sign)?=[^&\s]*/gi, 'client_secret=[redacted]').slice(0, 300);
  return `네이버 커머스 API 오류 (${status}): ${redacted || '응답 본문 없음'}`;
}

export function explainCommerceError(message: string) {
  if (message.includes('IP_NOT_ALLOWED') || message.includes('허용되지 않은 IP')) {
    return '사이트 서버 IP는 네이버에 허용되어 있지 않습니다. 센터 PC에서 npm run smartstore:center 를 실행하면 등록된 센터 IP로 호출합니다.';
  }
  return message;
}

export function assertChannelProductNo(value: string) {
  const channelProductNo = value.trim();
  if (!/^\d{5,20}$/.test(channelProductNo)) {
    throw new NaverCommerceError('채널 상품번호는 5~20자리 숫자여야 합니다.', 400);
  }
  return channelProductNo;
}

export function readDetailContent(product: Record<string, unknown>) {
  const origin = product.originProduct;
  const source = origin && typeof origin === 'object' && !Array.isArray(origin)
    ? origin as Record<string, unknown>
    : product;
  const value = source.detailContent;
  if (typeof value === 'string') return value;
  if (value == null) return null;
  return JSON.stringify(value);
}

export function replaceDetailContent<T extends Record<string, unknown>>(product: T, html: string): T {
  assertSafeDetailHtml(html);
  const next = structuredClone(product);
  const origin = next.originProduct;
  if (origin && typeof origin === 'object' && !Array.isArray(origin)) {
    (origin as Record<string, unknown>).detailContent = html;
    return next;
  }
  (next as Record<string, unknown>).detailContent = html;
  return next;
}

function unwrapProduct(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NaverCommerceError('상품 응답이 비어 있습니다.', 502);
  }
  const record = payload as Record<string, unknown>;
  if (record.originProduct && typeof record.originProduct === 'object') return record;
  if (record.data && typeof record.data === 'object') return unwrapProduct(record.data);
  if ('detailContent' in record || 'name' in record || 'originProductNo' in record) return record;
  throw new NaverCommerceError('상품 본문을 해석하지 못했습니다.', 502);
}

export function createNaverCommerceClient(options: {
  credentials: CommerceCredentialsInput | null;
  fetchImpl?: FetchLike;
  now?: () => number;
}) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  let cached: { token: string; expiresAt: number } | null = null;

  function requireCredentials() {
    if (!options.credentials?.clientId || !options.credentials.clientSecret) {
      throw new CommerceCredentialsError();
    }
    return options.credentials;
  }

  async function readError(response: Response) {
    const body = await response.text().catch(() => '');
    return new NaverCommerceError(sanitizeApiError(response.status, body), response.status);
  }

  async function requestToken() {
    const credentials = requireCredentials();
    const timestamp = now();
    const body = new URLSearchParams({
      client_id: credentials.clientId,
      timestamp: String(timestamp),
      client_secret_sign: createClientSecretSign(credentials.clientId, credentials.clientSecret, timestamp),
      grant_type: 'client_credentials',
      type: 'SELF',
    });
    const response = await fetchImpl(`${API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) throw await readError(response);
    const payload = await response.json() as { access_token?: string; expires_in?: number };
    if (!payload.access_token) {
      throw new NaverCommerceError('액세스 토큰이 응답에 없습니다.', 502);
    }
    const expiresIn = Number(payload.expires_in || 0);
    cached = {
      token: payload.access_token,
      expiresAt: now() + Math.max(expiresIn - 60, 30) * 1000,
    };
    return payload.access_token;
  }

  async function accessToken() {
    if (cached && cached.expiresAt > now()) return cached.token;
    return requestToken();
  }

  async function authorized(path: string, init: RequestInit, allowRetry = true): Promise<Response> {
    const token = await accessToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetchImpl(`${API_BASE}${path}`, { ...init, headers });
    if (response.status === 401 && allowRetry) {
      cached = null;
      return authorized(path, init, false);
    }
    return response;
  }

  return {
    async diagnose() {
      requireCredentials();
      await accessToken();
      return { ok: true as const };
    },
    async getProduct(channelProductNo: string) {
      const safeNo = assertChannelProductNo(channelProductNo);
      const response = await authorized(`/v2/products/channel-products/${safeNo}`, { method: 'GET' });
      if (!response.ok) throw await readError(response);
      return unwrapProduct(await response.json());
    },
    async updateDetailContent(channelProductNo: string, html: string) {
      assertSafeDetailHtml(html);
      const safeNo = assertChannelProductNo(channelProductNo);
      const current = await this.getProduct(safeNo);
      const beforeHtml = readDetailContent(current);
      const next = replaceDetailContent(current, html);
      const response = await authorized(`/v2/products/channel-products/${safeNo}`, {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      if (!response.ok) throw await readError(response);
      return { beforeHtml, afterHtml: html };
    },
  };
}
