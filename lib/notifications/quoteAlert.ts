import { ExternalQuoteInquiry } from '@/types';

const WEBHOOK_ENV_KEYS = ['QUOTE_ALERT_WEBHOOK_URL', 'CRM_WEBHOOK_URL'];

function getWebhookUrl(): string | undefined {
  for (const key of WEBHOOK_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }
  return undefined;
}

function buildPayload(inquiry: ExternalQuoteInquiry) {
  const summary = [
    `회사명: ${inquiry.companyName}`,
    `담당자: ${inquiry.contactName}`,
    `월 출고량: ${inquiry.monthlyOutboundRange}`,
    `SKU 수량: ${inquiry.skuCount ?? '미기재'}`,
    `상품군: ${inquiry.productCategories.join(', ') || '미기재'}`,
    `추가 작업: ${inquiry.extraServices.join(', ') || '없음'}`,
  ].join('\n');

  return {
    text: `🆕 신규 견적 문의가 등록되었습니다.\n${summary}`,
    inquiry: {
      id: inquiry.id,
      companyName: inquiry.companyName,
      contactName: inquiry.contactName,
      email: inquiry.email,
      phone: inquiry.phone,
      monthlyOutboundRange: inquiry.monthlyOutboundRange,
      skuCount: inquiry.skuCount,
      productCategories: inquiry.productCategories,
      extraServices: inquiry.extraServices,
      memo: inquiry.memo,
      source: inquiry.source,
      createdAt: inquiry.createdAt,
    },
  };
}

export async function sendQuoteInquiryAlert(inquiry: ExternalQuoteInquiry) {
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    console.warn('[quote-alert] webhook URL 미설정, 알림 전송 생략');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPayload(inquiry)),
    });

    if (!response.ok) {
      console.error('[quote-alert] 알림 전송 실패', await response.text());
    }
  } catch (error) {
    console.error('[quote-alert] 알림 전송 중 오류', error);
  }
}

