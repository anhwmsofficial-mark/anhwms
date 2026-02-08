import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { logAudit } from '@/utils/audit';
import { getOrdersPageWithClient } from '@/lib/api/orders';
import { logger } from '@/lib/logger';

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
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const cursor = searchParams.get('cursor');

    const includeLogs = searchParams.get('includeLogs') === 'true';

    const { data: orders, pagination } = await getOrdersPageWithClient(supabase as any, {
      status: status || undefined,
      logisticsCompany: logisticsCompany || undefined,
      limit,
      page,
      cursor: cursor || undefined,
      includeLogs,
    });

    return NextResponse.json({
      data: orders,
      pagination,
    });
  } catch (error: any) {
    logger.error(error, { scope: 'api', route: 'GET /api/orders' });
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
    logger.error(error, { scope: 'api', route: 'DELETE /api/orders' });
    const status = error.message.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json(
      { error: error.message || '삭제 실패' },
      { status }
    );
  }
}
