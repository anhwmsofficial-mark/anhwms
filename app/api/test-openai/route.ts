 
import { NextRequest } from 'next/server';
import { toAppApiError } from '@/lib/api/errors';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { requirePermission } from '@/utils/rbac';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/test-openai');
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const isProduction = process.env.NODE_ENV === 'production';
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

  if (isProduction) {
    logger.warn('Blocked internal diagnostics access', {
      ...ctx,
      target: 'test-openai',
      reason: 'production_disabled',
      ip: forwardedFor,
    });
    return fail('NOT_FOUND', '찾을 수 없습니다.', {
      status: 404,
      requestId: ctx.requestId,
    });
  }
  
  try {
    await requirePermission('manage:orders', request);
    if (!OPENAI_API_KEY) {
      return fail('INTERNAL_ERROR', 'OpenAI 테스트를 실행할 수 없습니다.', {
        status: 500,
        requestId: ctx.requestId,
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 10,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      logger.warn('OpenAI test API failed', {
        ...ctx,
        target: 'test-openai',
        reason: 'upstream_failure',
      });
      return fail('INTERNAL_ERROR', 'OpenAI 연결 테스트에 실패했습니다.', {
        status: 500,
        requestId: ctx.requestId,
      });
    }

    const data = JSON.parse(responseText);
    
    return ok({
      success: true,
      message: 'OpenAI 연결 확인 완료',
      result: typeof data?.choices?.[0]?.message?.content === 'string' ? 'ok' : 'unexpected_response',
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const apiError = toAppApiError(error, {
      error: '테스트 중 오류가 발생했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });

    if (apiError.status === 401 || apiError.status === 403 || apiError.code === 'UNAUTHORIZED' || apiError.code === 'FORBIDDEN') {
      logger.warn('Blocked internal diagnostics access', {
        ...ctx,
        target: 'test-openai',
        reason: 'insufficient_permission',
        ip: forwardedFor,
      });
      return fail(apiError.code || 'FORBIDDEN', apiError.message || 'Forbidden', {
        status: apiError.status === 401 ? 401 : 403,
        requestId: ctx.requestId,
      });
    }

    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(apiError.code || 'INTERNAL_ERROR', '테스트 중 오류가 발생했습니다.', {
      status: apiError.status,
      requestId: ctx.requestId,
    });
  }
}

