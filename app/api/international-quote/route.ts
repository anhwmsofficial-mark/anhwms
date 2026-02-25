import { NextRequest, NextResponse } from 'next/server';
import {
  createInternationalQuoteInquiry,
  MONTHLY_SHIPMENT_VOLUME_VALUES,
  SHIPPING_METHOD_VALUES,
  TRADE_TERMS_VALUES,
} from '@/lib/api/internationalQuotes';
import { sendQuoteInquiryAlert } from '@/lib/notifications/quoteAlert';
import { sendQuoteNotificationEmail } from '@/lib/email/quoteNotification';
import { MonthlyShipmentVolume, ShippingMethod, TradeTerms } from '@/types';
import { parseAmountInput, parseIntegerInput } from '@/utils/number-format';

const monthlyVolumeSet = new Set<string>(MONTHLY_SHIPMENT_VOLUME_VALUES);
const shippingMethodSet = new Set<string>(SHIPPING_METHOD_VALUES);
const tradeTermsSet = new Set<string>(TRADE_TERMS_VALUES);

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const companyName = body.company_name ?? body.companyName;
    const contactName = body.contact_name ?? body.contactName;
    const email = body.email;
    const phone = body.phone ?? null;
    const destinationCountries = normalizeStringArray(
      body.destination_countries ?? body.destinationCountries,
    );
    const shippingMethod = body.shipping_method ?? body.shippingMethod ?? null;
    const monthlyVolume = body.monthly_shipment_volume ?? body.monthlyShipmentVolume;
    const avgBoxWeight = parseAmountInput(body.avg_box_weight ?? body.avgBoxWeight);
    const skuCount = parseIntegerInput(body.sku_count ?? body.skuCount);
    const productCategories = normalizeStringArray(
      body.product_categories ?? body.productCategories,
    );
    const productCharacteristics = normalizeStringArray(
      body.product_characteristics ?? body.productCharacteristics,
    );
    const customsSupportNeeded = body.customs_support_needed ?? body.customsSupportNeeded ?? false;
    const tradeTerms = body.trade_terms ?? body.tradeTerms ?? null;
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

    if (destinationCountries.length === 0) {
      errors.push('목적지 국가를 선택해주세요.');
    }

    if (!monthlyVolume || typeof monthlyVolume !== 'string') {
      errors.push('월 발송량 구간은 필수입니다.');
    } else if (!monthlyVolumeSet.has(monthlyVolume)) {
      errors.push('월 발송량 구간 값이 올바르지 않습니다.');
    }

    if (shippingMethod && !shippingMethodSet.has(shippingMethod)) {
      errors.push('배송 방식 값이 올바르지 않습니다.');
    }

    if (tradeTerms && !tradeTermsSet.has(tradeTerms)) {
      errors.push('무역 조건 값이 올바르지 않습니다.');
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const inquiry = await createInternationalQuoteInquiry({
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      phone: phone ? String(phone).trim() : null,
      destinationCountries,
      shippingMethod: shippingMethod as ShippingMethod | null,
      monthlyShipmentVolume: monthlyVolume as MonthlyShipmentVolume,
      avgBoxWeight,
      skuCount,
      productCategories,
      productCharacteristics,
      customsSupportNeeded: Boolean(customsSupportNeeded),
      tradeTerms: tradeTerms as TradeTerms | null,
      memo: typeof memo === 'string' ? memo : null,
      source,
    });

    // Webhook 알림 발송 (실패해도 응답에는 영향 없음)
    sendQuoteInquiryAlert(inquiry as any).catch((error) => {
      console.error('[international-quote] 알림 전송 실패', error);
    });

    // 이메일 알림 전송
    sendQuoteNotificationEmail({
      type: 'international',
      companyName: inquiry.companyName,
      contactName: inquiry.contactName,
      email: inquiry.email,
      phone: inquiry.phone || undefined,
      destinationCountries: inquiry.destinationCountries,
      shippingMethod: inquiry.shippingMethod || undefined,
      monthlyVolume: inquiry.monthlyShipmentVolume,
      productCharacteristics: inquiry.productCharacteristics,
      memo: inquiry.memo || undefined,
      createdAt: inquiry.createdAt.toString(),
    }).catch((error) => {
      console.error('[international-quote] 이메일 알림 전송 실패', error);
    });

    return NextResponse.json({ inquiry }, { status: 201 });
  } catch (error) {
    console.error('[international-quote] 요청 처리 실패', error);
    return NextResponse.json(
      { error: '해외배송 견적 문의 저장 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

