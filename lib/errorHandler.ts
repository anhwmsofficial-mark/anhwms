/**
 * 중앙 집중식 에러 처리 시스템
 */

import { logger } from '@/lib/logger';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public context?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * API 에러를 AppError로 변환
 */
export function handleApiError(error: any): AppError {

  // Supabase 에러
  if (error.code) {
    switch (error.code) {
      case 'PGRST116':
        return new AppError('데이터를 찾을 수 없습니다.', 404, error.code);
      
      case '23505':
        return new AppError('이미 존재하는 데이터입니다. (중복 키)', 409, error.code);
      
      case '23503':
        return new AppError('참조 무결성 위반입니다. 관련 데이터를 먼저 삭제해주세요.', 400, error.code);
      
      case '23502':
        return new AppError('필수 항목이 누락되었습니다.', 400, error.code);
      
      case '42P01':
        return new AppError('테이블을 찾을 수 없습니다. 데이터베이스 스키마를 확인해주세요.', 500, error.code);
      
      case 'PGRST301':
        return new AppError('잘못된 요청입니다.', 400, error.code);
      
      default:
        return new AppError(
          error.message || '데이터베이스 오류가 발생했습니다.',
          500,
          error.code,
          error
        );
    }
  }

  // Supabase Auth 에러
  if (error.status) {
    switch (error.status) {
      case 400:
        return new AppError('잘못된 요청입니다.', 400);
      case 401:
        return new AppError('인증이 필요합니다. 다시 로그인해주세요.', 401);
      case 403:
        return new AppError('권한이 없습니다.', 403);
      case 404:
        return new AppError('요청한 리소스를 찾을 수 없습니다.', 404);
      case 429:
        return new AppError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429);
      case 500:
      case 502:
      case 503:
        return new AppError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 500);
    }
  }

  // 네트워크 에러
  if (error.message === 'Failed to fetch' || error.message === 'Network request failed') {
    return new AppError('네트워크 연결을 확인해주세요.', 503);
  }

  // 일반 에러
  return new AppError(
    error.message || '알 수 없는 오류가 발생했습니다.',
    500,
    undefined,
    error
  );
}

/**
 * 사용자 친화적인 에러 메시지 표시
 */
export function getErrorMessage(error: any): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  const appError = handleApiError(error);
  return appError.message;
}

/**
 * 에러 로깅 (프로덕션에서는 Sentry 등으로 전송)
 */
export function logError(error: any, context?: any) {
  const appError = error instanceof AppError ? error : handleApiError(error);
  
  const errorLog = {
    message: appError.message,
    code: appError.code,
    statusCode: appError.statusCode,
    stack: appError.stack,
    context,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
  };

  logger.error(appError, { context, errorLog });

  return errorLog;
}

/**
 * Promise rejection 에러 핸들러
 */
export async function handleAsyncError<T>(
  promise: Promise<T>,
  errorMessage?: string
): Promise<[T | null, AppError | null]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    const appError = handleApiError(error);
    if (errorMessage) {
      appError.message = errorMessage;
    }
    logError(appError);
    return [null, appError];
  }
}

/**
 * 에러 바운더리용 에러 리포터
 */
export function reportErrorToBoundary(error: Error, errorInfo: any) {
  logError(error, { errorInfo });
}




