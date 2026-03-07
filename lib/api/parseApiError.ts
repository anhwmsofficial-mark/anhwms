import { getDisplayMessageFromApiError, readClientApiError } from '@/lib/api/client';

export async function parseApiError(
  response: Response,
  fallbackMessage = '요청 처리에 실패했습니다.',
): Promise<{ error: string; message: string; code: string; status: number; requestId?: string; details?: unknown }> {
  const apiError = await readClientApiError(response, fallbackMessage);

  return {
    error: getDisplayMessageFromApiError(apiError, fallbackMessage),
    message: apiError.message,
    code: apiError.code || 'UNKNOWN_ERROR',
    status: apiError.status,
    requestId: apiError.requestId,
    ...(apiError.details !== undefined ? { details: apiError.details } : {}),
  };
}
