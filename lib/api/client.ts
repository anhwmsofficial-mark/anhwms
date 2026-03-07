export type ClientApiError = {
  code?: string;
  message: string;
  status: number;
  requestId?: string;
  details?: unknown;
};

type ApiErrorPayload = {
  code?: unknown;
  message?: unknown;
  error?: unknown;
  status?: unknown;
  requestId?: unknown;
  details?: unknown;
};

function normalizeClientApiError(
  status: number,
  payload: ApiErrorPayload | null,
  fallbackMessage: string,
  text = '',
): ClientApiError {
  const message =
    (typeof payload?.message === 'string' && payload.message) ||
    (typeof payload?.error === 'string' && payload.error) ||
    text ||
    fallbackMessage;

  return {
    code: typeof payload?.code === 'string' ? payload.code : undefined,
    message,
    status: typeof payload?.status === 'number' ? payload.status : status,
    requestId: typeof payload?.requestId === 'string' ? payload.requestId : undefined,
    details: payload?.details,
  };
}

export async function readClientApiError(
  response: Response,
  fallbackMessage = '요청 처리 중 오류가 발생했습니다.',
): Promise<ClientApiError> {
  let payload: ApiErrorPayload | null = null;
  let text = '';

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  } else {
    text = await response.text().catch(() => '');
  }

  return normalizeClientApiError(response.status, payload, fallbackMessage, text);
}

export function toClientApiError(
  status: number,
  payload: unknown,
  fallbackMessage = '요청 처리 중 오류가 발생했습니다.',
): ClientApiError {
  const normalizedPayload = payload && typeof payload === 'object' ? (payload as ApiErrorPayload) : null;
  return normalizeClientApiError(status, normalizedPayload, fallbackMessage);
}

export function unwrapApiData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export function isUnauthenticatedError(error: ClientApiError | null | undefined) {
  return error?.status === 401 || error?.code === 'UNAUTHORIZED';
}

export function isForbiddenError(error: ClientApiError | null | undefined) {
  return error?.status === 403 || error?.code === 'FORBIDDEN';
}

export function getPermissionErrorMessage(error: ClientApiError | null | undefined) {
  if (isUnauthenticatedError(error)) {
    return formatClientApiErrorMessage(error, '로그인이 필요합니다. 다시 로그인 후 시도해 주세요.');
  }
  if (isForbiddenError(error)) {
    return formatClientApiErrorMessage(error, '접근 권한이 없습니다.');
  }
  return formatClientApiErrorMessage(error);
}

export function formatClientApiErrorMessage(
  error: ClientApiError | null | undefined,
  fallbackMessage = '요청 처리 중 오류가 발생했습니다.',
) {
  const baseMessage = error?.message || fallbackMessage;
  if (!error?.requestId) {
    return baseMessage;
  }
  return `${baseMessage} (요청 ID: ${error.requestId})`;
}
