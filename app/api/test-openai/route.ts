/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { requirePermission } from '@/utils/rbac';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/test-openai');
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  try {
    await requirePermission('manage:orders', request);
    if (!OPENAI_API_KEY) {
      return fail('INTERNAL_ERROR', 'OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.', {
        status: 500,
        requestId: ctx.requestId,
        details: {
          checks: {
            hasApiKey: false,
          },
        },
      });
    }

    const keyPreview = OPENAI_API_KEY.substring(0, 10) + '...' + OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4);

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
      return fail('INTERNAL_ERROR', 'OpenAI API 호출 실패', {
        status: 500,
        requestId: ctx.requestId,
        details: {
          checks: {
            hasApiKey: true,
            apiKeyPreview: keyPreview,
            apiStatus: response.status,
            apiResponse: responseText,
          },
        },
      });
    }

    const data = JSON.parse(responseText);
    
    return ok({
      success: true,
      message: 'OpenAI API 연결 성공!',
      checks: {
        hasApiKey: true,
        apiKeyPreview: keyPreview,
        apiStatus: response.status,
        testResponse: data.choices[0].message.content,
      }
    }, { requestId: ctx.requestId });
  } catch (error: any) {
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail('INTERNAL_ERROR', '테스트 중 오류 발생', {
      status,
      requestId: ctx.requestId,
      details: {
        checks: {
          hasApiKey: Boolean(OPENAI_API_KEY),
          errorMessage: error.message,
          errorStack: error.stack,
        },
      },
    });
  }
}

