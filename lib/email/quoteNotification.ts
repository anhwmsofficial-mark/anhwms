// lib/email/quoteNotification.ts
// 견적 문의 이메일 알림 전송

export interface QuoteEmailData {
  type: 'domestic' | 'international';
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  // 국내 견적 전용
  monthlyOutboundRange?: string;
  skuCount?: number;
  productCategories?: string[];
  extraServices?: string[];
  // 해외 견적 전용
  destinationCountries?: string[];
  shippingMethod?: string;
  monthlyVolume?: string;
  productCharacteristics?: string[];
  // 공통
  memo?: string;
  createdAt: string;
}

const MONTHLY_RANGE_LABELS: Record<string, string> = {
  '0_1000': '1,000건 미만',
  '1000_2000': '1,000 ~ 2,000건',
  '2000_3000': '2,000 ~ 3,000건',
  '3000_5000': '3,000 ~ 5,000건',
  '5000_10000': '5,000 ~ 10,000건',
  '10000_30000': '10,000 ~ 30,000건',
  '30000_plus': '30,000건 이상',
};

const MONTHLY_VOLUME_LABELS: Record<string, string> = {
  '0_100': '100건 미만',
  '100_500': '100 ~ 500건',
  '500_1000': '500 ~ 1,000건',
  '1000_3000': '1,000 ~ 3,000건',
  '3000_plus': '3,000건 이상',
};

/**
 * 신규 견적 문의 이메일 알림 전송
 */
export async function sendQuoteNotificationEmail(data: QuoteEmailData): Promise<boolean> {
  try {
    const emailContent = generateEmailContent(data);
    
    // 실제 이메일 전송은 환경에 따라 다르게 구현
    // 여기서는 Webhook을 통해 전송 (Slack, Discord, Email service 등)
    const webhookUrl = process.env.QUOTE_EMAIL_WEBHOOK_URL || process.env.QUOTE_ALERT_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.warn('[Quote Email] Webhook URL not configured');
      return false;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'anh.offical@anhwms.com',
        subject: `[신규 견적 문의] ${data.type === 'domestic' ? '국내' : '해외'} - ${data.companyName}`,
        text: emailContent.text,
        html: emailContent.html,
        data: {
          type: data.type,
          companyName: data.companyName,
          contactName: data.contactName,
          email: data.email,
          phone: data.phone,
          createdAt: data.createdAt,
        },
      }),
    });

    if (!response.ok) {
      console.error('[Quote Email] Failed to send:', response.statusText);
      return false;
    }

    console.log('[Quote Email] Successfully sent notification');
    return true;
  } catch (error) {
    console.error('[Quote Email] Error:', error);
    return false;
  }
}

/**
 * 이메일 내용 생성
 */
function generateEmailContent(data: QuoteEmailData): { text: string; html: string } {
  const typeLabel = data.type === 'domestic' ? '국내 풀필먼트' : '해외배송/크로스보더';
  const date = new Date(data.createdAt).toLocaleString('ko-KR');

  let text = `
[ANH WMS 신규 견적 문의]

문의 유형: ${typeLabel}
접수 일시: ${date}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 기본 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
회사명: ${data.companyName}
담당자명: ${data.contactName}
이메일: ${data.email}
연락처: ${data.phone || '-'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 상세 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  if (data.type === 'domestic') {
    text += `
월 출고량: ${data.monthlyOutboundRange ? MONTHLY_RANGE_LABELS[data.monthlyOutboundRange] : '-'}
SKU 수량: ${data.skuCount || '-'}
상품군: ${data.productCategories && data.productCategories.length > 0 ? data.productCategories.join(', ') : '-'}
추가 작업: ${data.extraServices && data.extraServices.length > 0 ? data.extraServices.join(', ') : '-'}
`;
  } else {
    text += `
목적지 국가: ${data.destinationCountries && data.destinationCountries.length > 0 ? data.destinationCountries.join(', ') : '-'}
배송 방식: ${data.shippingMethod || '-'}
월 발송량: ${data.monthlyVolume ? MONTHLY_VOLUME_LABELS[data.monthlyVolume] : '-'}
상품 특성: ${data.productCharacteristics && data.productCharacteristics.length > 0 ? data.productCharacteristics.join(', ') : '-'}
`;
  }

  if (data.memo) {
    text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 추가 메모
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${data.memo}
`;
  }

  text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 관리자 페이지에서 확인: https://www.anhwms.com/admin/quote-inquiries
`;

  // HTML 버전
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 10px 0 0; opacity: 0.9; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: bold; color: #667eea; margin-bottom: 10px; border-bottom: 2px solid #667eea; padding-bottom: 5px; }
    .info-row { display: flex; margin-bottom: 8px; }
    .info-label { font-weight: 600; min-width: 100px; color: #6b7280; }
    .info-value { color: #111827; }
    .memo-box { background: #f9fafb; padding: 15px; border-left: 4px solid #667eea; border-radius: 4px; margin-top: 10px; }
    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 신규 견적 문의가 접수되었습니다</h1>
      <p>${typeLabel} 견적 문의</p>
      <p style="font-size: 14px; margin-top: 5px;">접수 일시: ${date}</p>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="section-title">📋 기본 정보</div>
        <div class="info-row">
          <div class="info-label">회사명:</div>
          <div class="info-value">${data.companyName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">담당자명:</div>
          <div class="info-value">${data.contactName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">이메일:</div>
          <div class="info-value"><a href="mailto:${data.email}">${data.email}</a></div>
        </div>
        <div class="info-row">
          <div class="info-label">연락처:</div>
          <div class="info-value">${data.phone || '-'}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📦 상세 정보</div>
        ${data.type === 'domestic' ? `
        <div class="info-row">
          <div class="info-label">월 출고량:</div>
          <div class="info-value">${data.monthlyOutboundRange ? MONTHLY_RANGE_LABELS[data.monthlyOutboundRange] : '-'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">SKU 수량:</div>
          <div class="info-value">${data.skuCount || '-'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">상품군:</div>
          <div class="info-value">${data.productCategories && data.productCategories.length > 0 ? data.productCategories.join(', ') : '-'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">추가 작업:</div>
          <div class="info-value">${data.extraServices && data.extraServices.length > 0 ? data.extraServices.join(', ') : '-'}</div>
        </div>
        ` : `
        <div class="info-row">
          <div class="info-label">목적지 국가:</div>
          <div class="info-value">${data.destinationCountries && data.destinationCountries.length > 0 ? data.destinationCountries.join(', ') : '-'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">배송 방식:</div>
          <div class="info-value">${data.shippingMethod || '-'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">월 발송량:</div>
          <div class="info-value">${data.monthlyVolume ? MONTHLY_VOLUME_LABELS[data.monthlyVolume] : '-'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">상품 특성:</div>
          <div class="info-value">${data.productCharacteristics && data.productCharacteristics.length > 0 ? data.productCharacteristics.join(', ') : '-'}</div>
        </div>
        `}
      </div>

      ${data.memo ? `
      <div class="section">
        <div class="section-title">💬 추가 메모</div>
        <div class="memo-box">${data.memo.replace(/\n/g, '<br>')}</div>
      </div>
      ` : ''}

      <div style="text-align: center;">
        <a href="https://www.anhwms.com/admin/quote-inquiries" class="button">
          관리자 페이지에서 확인하기 →
        </a>
      </div>
    </div>

    <div class="footer">
      <p>이 이메일은 ANH WMS 시스템에서 자동으로 발송되었습니다.</p>
      <p>© ${new Date().getFullYear()} ANH Group. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

  return { text, html };
}


