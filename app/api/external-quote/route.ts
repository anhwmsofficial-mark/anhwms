import { NextRequest, NextResponse } from 'next/server';
import {
  createExternalQuoteInquiry,
  MONTHLY_OUTBOUND_RANGE_VALUES,
} from '@/lib/api/externalQuotes';
import { sendQuoteInquiryAlert } from '@/lib/notifications/quoteAlert';
import { sendQuoteNotificationEmail } from '@/lib/email/quoteNotification';
import { MonthlyOutboundRange } from '@/types';

const monthlyRangeSet = new Set<string>(MONTHLY_OUTBOUND_RANGE_VALUES);

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseSkuCount(rawValue: unknown): number | null {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return Math.max(0, Math.round(rawValue));
  }

  if (typeof rawValue === 'string') {
    const digits = rawValue.replace(/[^0-9]/g, '');
    if (digits.length === 0) return null;
    return parseInt(digits, 10);
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const companyName = body.company_name ?? body.companyName;
    const contactName = body.contact_name ?? body.contactName;
    const email = body.email;
    const phone = body.phone ?? null;
    const monthlyRange = body.monthly_outbound_range ?? body.monthlyOutboundRange;
    const skuCount = parseSkuCount(body.sku_count ?? body.skuCount);
    const productCategories = normalizeStringArray(
      body.product_categories ?? body.productCategories,
    );
    const extraServices = normalizeStringArray(body.extra_services ?? body.extraServices);
    const memo = body.memo ?? null;
    const source = body.source ?? 'web_form';

    const errors: string[] = [];

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      errors.push('회사명은 필수입니다.');
    }

    if (!contactName || typeof contactName !== 'string' || contactName.trim().length === 0) {
      errors.push('담당자명은 필수입니다.');
    }

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      errors.push('이메일은 필수입니다.');
    }

    if (!monthlyRange || typeof monthlyRange !== 'string') {
      errors.push('월 출고량 구간은 필수입니다.');
    } else if (!monthlyRangeSet.has(monthlyRange)) {
      errors.push('월 출고량 구간 값이 올바르지 않습니다.');
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const inquiry = await createExternalQuoteInquiry({
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      phone: phone ? String(phone).trim() : null,
      monthlyOutboundRange: monthlyRange as MonthlyOutboundRange,
      skuCount,
      productCategories,
      extraServices,
      memo: typeof memo === 'string' ? memo : null,
      source,
    });

    // Webhook 알림 전송
    sendQuoteInquiryAlert(inquiry).catch((error) => {
      console.error('[external-quote] 알림 전송 실패', error);
    });

    // 이메일 알림 전송
    sendQuoteNotificationEmail({
      type: 'domestic',
      companyName: inquiry.companyName,
      contactName: inquiry.contactName,
      email: inquiry.email,
      phone: inquiry.phone || undefined,
      monthlyOutboundRange: inquiry.monthlyOutboundRange,
      skuCount: inquiry.skuCount || undefined,
      productCategories: inquiry.productCategories,
      extraServices: inquiry.extraServices,
      memo: inquiry.memo || undefined,
      createdAt: inquiry.createdAt.toString(),
    }).catch((error) => {
      console.error('[external-quote] 이메일 알림 전송 실패', error);
    });

    return NextResponse.json({ inquiry }, { status: 201 });
  } catch (error) {
    console.error('[external-quote] 요청 처리 실패', error);
    return NextResponse.json(
      { error: '견적 문의 저장 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

