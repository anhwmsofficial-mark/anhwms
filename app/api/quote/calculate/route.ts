import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateQuote } from '@/lib/api/quoteCalculator';
import { CalculateQuoteInput } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CalculateQuoteInput = await request.json();

    if (!body.inquiryId || !body.inquiryType || !body.monthlyVolume) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const calculation = await calculateQuote(body);

    return NextResponse.json({ data: calculation }, { status: 200 });
  } catch (error: any) {
    console.error('[POST /api/quote/calculate] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate quote' },
      { status: 500 },
    );
  }
}

