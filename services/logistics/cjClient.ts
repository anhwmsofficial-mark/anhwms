import crypto from 'crypto';
import { CJRegBookPayload, CJRegBookResponse } from '@/types';

/**
 * CJ 브리지 API 호출 (RegBook - 등록)
 * 
 * - HMAC 서명으로 무결성 보장
 * - Idempotency Key로 중복 방지
 * - 외부 PHP 어댑터로 전송
 */
export async function cjRegBookCall(
  baseUrl: string,
  payload: CJRegBookPayload,
  secret: string
): Promise<{ status: number; data: CJRegBookResponse | null }> {
  try {
    const body = JSON.stringify(payload);
    const ts = new Date().toISOString();
    const idem = crypto.randomUUID();
    
    // HMAC-SHA256 서명 생성
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');

    const res = await fetch(`${baseUrl}/cj/v1/regbook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ANH-Idempotency-Key': idem,
        'X-ANH-Timestamp': ts,
        'X-ANH-Signature': sig,
      },
      body,
      signal: AbortSignal.timeout(30000), // 30초 타임아웃
    });

    if (!res.ok) {
      console.error(`CJ Bridge HTTP Error: ${res.status}`);
      return {
        status: res.status,
        data: {
          result: 'F',
          cj: {
            RESULT_CD: 'F',
            RESULT_DETAIL: `HTTP ${res.status}`,
          },
        },
      };
    }

    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch (error: unknown) {
    console.error('CJ Bridge Call Failed:', error);
    return {
      status: 0,
      data: {
        result: 'F',
        cj: {
          RESULT_CD: 'F',
          RESULT_DETAIL: error instanceof Error ? error.message : 'Network Error',
        },
      },
    };
  }
}

/**
 * CJ 송장 취소 (선택 사항)
 */
export async function cjCancelCall(
  baseUrl: string,
  invoiceNo: string,
  secret: string
): Promise<{ status: number; data: unknown }> {
  try {
    const body = JSON.stringify({ invoiceNo });
    const ts = new Date().toISOString();
    const idem = crypto.randomUUID();
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');

    const res = await fetch(`${baseUrl}/cj/v1/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ANH-Idempotency-Key': idem,
        'X-ANH-Timestamp': ts,
        'X-ANH-Signature': sig,
      },
      body,
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch (error: unknown) {
    console.error('CJ Cancel Failed:', error);
    return {
      status: 0,
      data: {
        result: 'F',
        reason: error instanceof Error ? error.message : 'Network Error',
      },
    };
  }
}

/**
 * CJ 브리지 헬스체크
 */
export async function cjHealthCheck(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/cj/v1/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (error) {
    console.error('CJ Health Check Failed:', error);
    return false;
  }
}

