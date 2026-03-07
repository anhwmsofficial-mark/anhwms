import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/utils/supabase/server';
import { toAppApiError } from '@/lib/api/errors';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { requirePermission } from '@/utils/rbac';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';

type GlossaryBody = {
  term_ko?: string;
  term_zh?: string;
  note?: string | null;
  priority?: number;
  active?: boolean;
};

async function ensureAuthorized(request: NextRequest) {
  await requirePermission('read:orders', request);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET: 용어집 조회
export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/cs/glossary');
  try {
    const user = await ensureAuthorized(request);
    if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.', { status: 401, requestId: ctx.requestId });

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('cs_glossary')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return ok({
      items: data || [],
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: '용어집 조회 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', '용어집 조회 실패', {
      status: apiError.status,
      requestId: ctx.requestId,
      details: getErrorMessage(error),
    });
  }
}

// POST: 용어 추가
export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/cs/glossary');
  try {
    const user = await ensureAuthorized(request);
    if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.', { status: 401, requestId: ctx.requestId });

    const supabase = getSupabaseAdminClient();
    const body = (await request.json()) as GlossaryBody;
    const { term_ko, term_zh, note, priority, active } = body;

    if (!term_ko || !term_zh) {
      return fail('BAD_REQUEST', 'term_ko와 term_zh는 필수입니다.', { status: 400, requestId: ctx.requestId });
    }

    const { data, error } = await supabase
      .from('cs_glossary')
      .insert({
        term_ko,
        term_zh,
        note: note || null,
        priority: priority || 5,
        active: active !== undefined ? active : true,
      })
      .select()
      .single();

    if (error) throw error;

    return ok({
      success: true,
      term: data,
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: '용어 추가 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', '용어 추가 실패', {
      status: apiError.status,
      requestId: ctx.requestId,
      details: getErrorMessage(error),
    });
  }
}

// PUT: 용어 수정
export async function PUT(request: NextRequest) {
  const ctx = getRouteContext(request, 'PUT /api/cs/glossary');
  try {
    const user = await ensureAuthorized(request);
    if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.', { status: 401, requestId: ctx.requestId });

    const supabase = getSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return fail('BAD_REQUEST', 'id 파라미터가 필요합니다.', { status: 400, requestId: ctx.requestId });
    }

    const body = (await request.json()) as GlossaryBody;
    const { term_ko, term_zh, note, priority, active } = body;

    const { data, error } = await supabase
      .from('cs_glossary')
      .update({
        term_ko,
        term_zh,
        note: note || null,
        priority: priority || 5,
        active: active !== undefined ? active : true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return ok({
      success: true,
      term: data,
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: '용어 수정 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', '용어 수정 실패', {
      status: apiError.status,
      requestId: ctx.requestId,
      details: getErrorMessage(error),
    });
  }
}

// DELETE: 용어 삭제
export async function DELETE(request: NextRequest) {
  const ctx = getRouteContext(request, 'DELETE /api/cs/glossary');
  try {
    const user = await ensureAuthorized(request);
    if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.', { status: 401, requestId: ctx.requestId });

    const supabase = getSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return fail('BAD_REQUEST', 'id 파라미터가 필요합니다.', { status: 400, requestId: ctx.requestId });
    }

    const { error } = await supabase
      .from('cs_glossary')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return ok({
      success: true,
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: '용어 삭제 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', '용어 삭제 실패', {
      status: apiError.status,
      requestId: ctx.requestId,
      details: getErrorMessage(error),
    });
  }
}

