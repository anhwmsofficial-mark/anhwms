import { NextRequest } from 'next/server';
import { calculateQuote } from '@/lib/api/quoteCalculator';
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
      return fail('UNAUTHORIZED', 'Unauthorized', { status: 401 });
    }

    const body: CalculateQuoteInput = await request.json();

    if (!body.inquiryId || !body.inquiryType || !body.monthlyVolume) {
      return fail('BAD_REQUEST', 'Missing required fields', { status: 400 });
    }

    const calculation = await calculateQuote(body);

    return ok(calculation, { status: 200 });
  } catch (error: any) {
    console.error('[POST /api/quote/calculate] error:', error);
    if (error instanceof Error && /Unauthorized:/i.test(error.message)) {
      return fail('FORBIDDEN', '견적 계산 권한이 없습니다.', { status: 403 });
    }
    return fail('INTERNAL_ERROR', error.message || 'Failed to calculate quote', { status: 500 });
  }
}




