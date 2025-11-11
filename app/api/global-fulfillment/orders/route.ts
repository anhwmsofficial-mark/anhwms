import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: 주문 목록 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const step = searchParams.get('step');

    let query = supabase
      .from('global_fulfillment_orders')
      .select(`
        *,
        customer:global_customers(*)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (step) {
      query = query.eq('current_step', step);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST: 새 주문 생성
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('global_fulfillment_orders')
      .insert({
        order_number: body.orderNumber,
        customer_id: body.customerId,
        platform_order_id: body.platformOrderId,
        current_step: 'drop_shipping',
        status: 'pending',
        origin_country: body.originCountry || 'CN',
        destination_country: body.destinationCountry || 'KR',
        warehouse_location: body.warehouseLocation,
        shipping_method: body.shippingMethod,
        ordered_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}

