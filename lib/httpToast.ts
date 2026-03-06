import { showError } from '@/lib/toast';

const STATUS_MESSAGE_MAP: Record<number, string> = {
  400: '요청값을 확인해주세요.',
  401: '로그인이 필요합니다.',
  403: '권한이 없습니다.',
  404: '요청한 데이터를 찾을 수 없습니다.',
  409: '이미 처리된 요청이거나 충돌이 발생했습니다.',
  413: '업로드 용량 제한을 초과했습니다.',
  422: '입력값 검증에 실패했습니다.',
  429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  502: '서버 연결이 원활하지 않습니다. 잠시 후 다시 시도해주세요.',
  503: '서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.',
  504: '응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
};

type ErrorPayload = {
  error?: unknown;
  message?: unknown;
  details?: unknown;
};

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  return '';
}

export function resolveHttpErrorMessage(status: number, fallback?: string): string {
  return STATUS_MESSAGE_MAP[status] || fallback || '요청 처리 중 오류가 발생했습니다.';
}

export async function readErrorPayload(response: Response): Promise<ErrorPayload | null> {
  try {
    return (await response.json()) as ErrorPayload;
  } catch {
    return null;
  }
}

export function extractPayloadMessage(payload: ErrorPayload | null): string {
  if (!payload) return '';
  return toText(payload.error) || toText(payload.message) || toText(payload.details);
}

export async function toastHttpError(
  response: Response,
  fallback?: string,
): Promise<string> {
  const payload = await readErrorPayload(response);
  const message =
    extractPayloadMessage(payload) || resolveHttpErrorMessage(response.status, fallback);
  showError(message);
  return message;
}

