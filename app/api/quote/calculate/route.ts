import { NextRequest } from 'next/server';
import { calculateQuote } from '@/lib/api/quoteCalculator';
import { toAppApiError } from '@/lib/api/errors';
import { CalculateQuoteInput } from '@/types';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { fail, ok } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', '로그인이 필요합니다.', { status: 401 });
    }

    const body: CalculateQuoteInput = await request.json();

    if (!body.inquiryId || !body.inquiryType || !body.monthlyVolume) {
      return fail('BAD_REQUEST', 'Missing required fields', { status: 400 });
    }

    const calculation = await calculateQuote(body);

    return ok(calculation, { status: 200 });
  } catch (error: unknown) {
    const apiError = toAppApiError(error, {
      error: 'Failed to calculate quote',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      details: apiError.details,
    });
  }
}




