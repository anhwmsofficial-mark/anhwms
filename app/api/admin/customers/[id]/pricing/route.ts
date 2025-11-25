import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import { CustomerPricing, CreateCustomerPricingInput } from '@/types';

// 거래처 가격 정책 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const isActive = searchParams.get('active') !== 'false';

    let query = supabaseAdmin
      .from('customer_pricing')
      .select('*')
      .eq('customer_master_id', customerId);

    if (isActive) {
      query = query.eq('is_active', true);
    }

    query = query.order('effective_from', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    const pricings: CustomerPricing[] = (data || []).map((row: any) => ({
      id: row.id,
      customerMasterId: row.customer_master_id,
      orgId: row.org_id,
      pricingType: row.pricing_type,
      serviceName: row.service_name,
      serviceCode: row.service_code,
      unitPrice: row.unit_price,
      currency: row.currency,
      unit: row.unit,
      minQuantity: row.min_quantity,
      maxQuantity: row.max_quantity,
      effectiveFrom: new Date(row.effective_from),
      effectiveTo: row.effective_to ? new Date(row.effective_to) : null,
      volumeDiscountRate: row.volume_discount_rate,
      volumeThreshold: row.volume_threshold,
      requiresApproval: row.requires_approval,
      isActive: row.is_active,
      note: row.note,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

    return NextResponse.json({ success: true, data: pricings });
  } catch (error: any) {
    console.error('Error fetching customer pricing:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 거래처 가격 정책 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const body: CreateCustomerPricingInput = await req.json();

    const { data, error } = await supabaseAdmin
      .from('customer_pricing')
      .insert({
        customer_master_id: customerId,
        org_id: body.orgId,
        pricing_type: body.pricingType,
        service_name: body.serviceName,
        service_code: body.serviceCode,
        unit_price: body.unitPrice,
        currency: body.currency || 'KRW',
        unit: body.unit,
        min_quantity: body.minQuantity,
        max_quantity: body.maxQuantity,
        effective_from: body.effectiveFrom || new Date(),
        effective_to: body.effectiveTo,
        volume_discount_rate: body.volumeDiscountRate,
        volume_threshold: body.volumeThreshold,
        is_active: true,
        note: body.note,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error creating customer pricing:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

