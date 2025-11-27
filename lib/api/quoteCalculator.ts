import supabaseAdmin from '@/lib/supabase-admin';
import { QuoteCalculation, QuotePricingRule, CalculateQuoteInput } from '@/types';

/**
 * 견적 산정 규칙 조회 (조건에 맞는 규칙 찾기)
 */
async function findMatchingPricingRule(
  monthlyVolume: number,
  skuCount?: number,
  productCategories?: string[],
): Promise<QuotePricingRule | null> {
  let query = supabaseAdmin
    .from('quote_pricing_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  const { data, error } = await query;

  if (error || !data) {
    console.error('[findMatchingPricingRule] error:', error);
    return null;
  }

  // 조건에 맞는 첫 번째 규칙 반환
  for (const rule of data) {
    // 물량 체크
    if (rule.min_monthly_volume && monthlyVolume < rule.min_monthly_volume) continue;
    if (rule.max_monthly_volume && monthlyVolume > rule.max_monthly_volume) continue;

    // SKU 수 체크
    if (skuCount) {
      if (rule.min_sku_count && skuCount < rule.min_sku_count) continue;
      if (rule.max_sku_count && skuCount > rule.max_sku_count) continue;
    }

    // 조건 모두 만족하면 이 규칙 사용
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      isActive: rule.is_active,
      priority: rule.priority,
      minMonthlyVolume: rule.min_monthly_volume,
      maxMonthlyVolume: rule.max_monthly_volume,
      minSkuCount: rule.min_sku_count,
      maxSkuCount: rule.max_sku_count,
      productCategories: rule.product_categories,
      baseFee: parseFloat(rule.base_fee),
      pickingFee: parseFloat(rule.picking_fee),
      packingFee: parseFloat(rule.packing_fee),
      storageFee: parseFloat(rule.storage_fee),
      extraServiceFees: rule.extra_service_fees || {},
      volumeDiscount: rule.volume_discount || {},
      createdAt: new Date(rule.created_at),
      updatedAt: new Date(rule.updated_at),
    };
  }

  return null;
}

/**
 * 견적 자동 계산
 */
export async function calculateQuote(
  input: CalculateQuoteInput,
): Promise<QuoteCalculation> {
  // 적용할 가격 규칙 찾기
  const rule = await findMatchingPricingRule(
    input.monthlyVolume,
    input.skuCount,
    input.productCategories,
  );

  if (!rule) {
    throw new Error('적용 가능한 가격 규칙을 찾을 수 없습니다.');
  }

  // 기본 비용 계산
  const baseFee = rule.baseFee;
  const pickingFee = rule.pickingFee * input.monthlyVolume;
  const packingFee = rule.packingFee * input.monthlyVolume;
  const storageFee = rule.storageFee * (input.skuCount || 0);

  // 부가 서비스 비용
  let extraServiceFee = 0;
  const extraServiceDetails: Record<string, number> = {};

  if (input.extraServices && input.extraServices.length > 0) {
    input.extraServices.forEach((service) => {
      const fee = rule.extraServiceFees[service] || 0;
      if (fee > 0) {
        const serviceCost = fee * input.monthlyVolume;
        extraServiceFee += serviceCost;
        extraServiceDetails[service] = serviceCost;
      }
    });
  }

  // 소계
  let subtotal = baseFee + pickingFee + packingFee + storageFee + extraServiceFee;

  // 사용자 정의 조정
  if (input.customAdjustments) {
    Object.values(input.customAdjustments).forEach((adjustment) => {
      subtotal += adjustment;
    });
  }

  // 할인 (물량 할인 등)
  let discount = 0;
  if (rule.volumeDiscount) {
    // 간단한 물량 할인 로직
    const discountRate = rule.volumeDiscount[String(input.monthlyVolume)] || 0;
    discount = subtotal * (discountRate / 100);
  }

  const total = subtotal - discount;

  // 계산 상세 데이터
  const calculationData = {
    rule: {
      id: rule.id,
      name: rule.name,
    },
    baseFee,
    pickingFee,
    packingFee,
    storageFee,
    extraServiceFee,
    extraServiceDetails,
    monthlyVolume: input.monthlyVolume,
    skuCount: input.skuCount,
    customAdjustments: input.customAdjustments || {},
  };

  // 데이터베이스에 저장
  const { data, error } = await supabaseAdmin
    .from('quote_calculations')
    .insert({
      inquiry_id: input.inquiryId,
      inquiry_type: input.inquiryType,
      pricing_rule_id: rule.id,
      calculation_data: calculationData,
      subtotal,
      discount,
      total,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[calculateQuote] error:', error);
    throw new Error('견적 계산 저장에 실패했습니다.');
  }

  return {
    id: data.id,
    inquiryId: data.inquiry_id,
    inquiryType: data.inquiry_type,
    pricingRuleId: data.pricing_rule_id,
    calculationData: data.calculation_data,
    subtotal: parseFloat(data.subtotal),
    discount: parseFloat(data.discount),
    total: parseFloat(data.total),
    calculatedBy: data.calculated_by,
    isSent: data.is_sent,
    sentAt: data.sent_at ? new Date(data.sent_at) : null,
    notes: data.notes,
    createdAt: new Date(data.created_at),
  };
}

/**
 * 견적 계산 히스토리 조회
 */
export async function getQuoteCalculations(
  inquiryId: string,
  inquiryType: 'external' | 'international',
): Promise<QuoteCalculation[]> {
  const { data, error } = await supabaseAdmin
    .from('quote_calculations')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .eq('inquiry_type', inquiryType)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getQuoteCalculations] error:', error);
    throw new Error('견적 히스토리 조회에 실패했습니다.');
  }

  return (data || []).map((row) => ({
    id: row.id,
    inquiryId: row.inquiry_id,
    inquiryType: row.inquiry_type,
    pricingRuleId: row.pricing_rule_id,
    calculationData: row.calculation_data,
    subtotal: parseFloat(row.subtotal),
    discount: parseFloat(row.discount),
    total: parseFloat(row.total),
    calculatedBy: row.calculated_by,
    isSent: row.is_sent,
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
    notes: row.notes,
    createdAt: new Date(row.created_at),
  }));
}

