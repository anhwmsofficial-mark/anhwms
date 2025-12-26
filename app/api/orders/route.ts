import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { logAudit } from '@/utils/audit';
import { Order } from '@/types';

/**
 * 주문 목록 조회 API
 * GET /api/orders?status=CREATED&logisticsCompany=CJ
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 권한 체크
    await requirePermission('read:orders');
    
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const logisticsCompany = searchParams.get('logisticsCompany');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    let query = supabase
      .from('orders')
      .select(`
        *,
        receiver:order_receivers(*)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (logisticsCompany) {
      query = query.eq('logistics_company', logisticsCompany);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    // 데이터 매핑
    const orders = data.map((item: any) => ({
      id: item.id,
      orderNo: item.order_no,
      userId: item.user_id,
      countryCode: item.country_code,
      productName: item.product_name,
      remark: item.remark,
      logisticsCompany: item.logistics_company,
      trackingNo: item.tracking_no,
      status: item.status,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      receiver: item.receiver?.[0]
        ? {
            id: item.receiver[0].id,
            orderId: item.receiver[0].order_id,
            name: item.receiver[0].name,
            phone: item.receiver[0].phone,
            zip: item.receiver[0].zip,
            address1: item.receiver[0].address1,
            address2: item.receiver[0].address2,
            locality: item.receiver[0].locality,
            countryCode: item.receiver[0].country_code,
            meta: item.receiver[0].meta,
            createdAt: new Date(item.receiver[0].created_at),
          }
        : undefined,
    })) as Order[];

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error('Get Orders Error:', error);
    const status = error.message.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json(
      { error: error.message || '조회 실패' },
      { status }
    );
  }
}

/**
 * 주문 삭제 API
 * DELETE /api/orders?id=xxx
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '주문 ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    // 1. 권한 체크
    // delete 권한은 manage:orders에 포함되거나 별도 분리 가능
    // 여기서는 MVP 정책에 따라 staff는 불가하도록 manage:orders 체크
    await requirePermission('manage:orders'); // manager 이상

    const supabase = await createClient();

    // 2. 삭제 전 데이터 조회 (Audit용)
    const { data: oldData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

    // 3. 삭제
    const { error } = await supabase.from('orders').delete().eq('id', id);

    if (error) throw error;

    // 4. Audit Log
    await logAudit({
      actionType: 'DELETE',
      resourceType: 'orders',
      resourceId: id,
      oldValue: oldData,
      reason: 'API Request'
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete Order Error:', error);
    const status = error.message.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json(
      { error: error.message || '삭제 실패' },
      { status }
    );
  }
}
