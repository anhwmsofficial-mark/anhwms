import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. 재고 부족 상품 수 (quantity < min_stock)
    // 참고: supabaseAdmin.rpc('get_low_stock_count') 같은 함수가 있다면 좋겠지만,
    // 현재는 직접 쿼리하거나 필터링해야 함. min_stock은 컬럼끼리 비교해야 하므로
    // .filter('quantity', 'lt', 'min_stock') 은 불가능 (값 비교만 가능)
    // 따라서, RPC를 쓰지 않는다면 전체 데이터를 스캔해야 하는 한계가 있음.
    // 하지만 products 테이블이 아주 크지 않다면 id, quantity, min_stock만 가져와서 계산하는 것이 빠름.
    
    // 더 효율적인 방법: DB 함수(RPC)를 쓰는 것이 좋으나 마이그레이션 없이 진행하기 위해
    // 필요한 컬럼만 최소한으로 가져와서 메모리에서 카운팅 (수천 건 단위까지는 매우 빠름)
    
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, quantity, min_stock');

    if (error) throw error;

    const lowStockProductIds = new Set<string>();
    
    products.forEach(p => {
      // min_stock이 설정되어 있고(0보다 크고), 현재 재고가 min_stock보다 작을 때
      if ((p.min_stock || 0) > 0 && (p.quantity || 0) < (p.min_stock || 0)) {
        lowStockProductIds.add(p.id);
      }
    });

    const lowStockCount = lowStockProductIds.size;

    // 2. 입고 예정 상품 수 (재고 부족 상태이면서 입고가 예정된 상품)
    // 입고 예정 데이터 조회 (진행 중인 입고 계획의 라인들)
    let inboundExpectedCount = 0;
    
    if (lowStockCount > 0) {
       // 진행 중인 입고 건 조회
      const { data: pendingReceipts } = await supabaseAdmin
        .from('inbound_receipts')
        .select('plan_id')
        .in('status', ['ARRIVED', 'PHOTO_REQUIRED', 'COUNTING', 'INSPECTING']);

      const planIds = Array.from(new Set((pendingReceipts || []).map((r: any) => r.plan_id).filter(Boolean)));

      if (planIds.length > 0) {
        const { data: planLines } = await supabaseAdmin
          .from('inbound_plan_lines')
          .select('product_id')
          .in('plan_id', planIds);

        const incomingProductIds = new Set((planLines || []).map((l: any) => l.product_id));

        // 재고 부족 상품 중 입고 예정이 있는 것 카운트
        inboundExpectedCount = Array.from(lowStockProductIds).filter(id => incomingProductIds.has(id)).length;
      }
    }

    return NextResponse.json({
      data: {
        lowStockCount,
        inboundExpectedCount
      }
    });
  } catch (error: any) {
    console.error('GET /api/admin/inventory/stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
