import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 전체 주문 수 조회
    const { data: orders, error: ordersError } = await supabase
      .from('global_fulfillment_orders')
      .select('*');

    if (ordersError) throw ordersError;

    // 통계 계산
    const stats = {
      totalOrders: orders?.length || 0,
      pendingOrders: orders?.filter(o => o.status === 'pending').length || 0,
      inProgressOrders: orders?.filter(o => o.status === 'in_progress').length || 0,
      completedOrders: orders?.filter(o => o.status === 'completed').length || 0,
      delayedOrders: orders?.filter(o => o.status === 'delayed').length || 0,
      exceptionOrders: orders?.filter(o => o.status === 'error').length || 0,
      
      byStep: {
        drop_shipping: orders?.filter(o => o.current_step === 'drop_shipping').length || 0,
        preparation: orders?.filter(o => o.current_step === 'preparation').length || 0,
        wave_management: orders?.filter(o => o.current_step === 'wave_management').length || 0,
        second_sorting: orders?.filter(o => o.current_step === 'second_sorting').length || 0,
        inspection: orders?.filter(o => o.current_step === 'inspection').length || 0,
        package_check: orders?.filter(o => o.current_step === 'package_check').length || 0,
        weight_check: orders?.filter(o => o.current_step === 'weight_check').length || 0,
        completed: orders?.filter(o => o.current_step === 'completed').length || 0,
        exception: orders?.filter(o => o.current_step === 'exception').length || 0,
        returned: orders?.filter(o => o.current_step === 'returned').length || 0
      },
      
      byCountry: {},
      byCustomer: [],
      topExceptions: [],
      recentActivity: []
    };

    // 국가별 집계
    const countryGroups: any = {};
    orders?.forEach(order => {
      const country = order.origin_country || 'Unknown';
      countryGroups[country] = (countryGroups[country] || 0) + 1;
    });
    stats.byCountry = countryGroups;

    // 이상 건수 조회
    const { data: exceptions } = await supabase
      .from('global_exceptions')
      .select('*')
      .eq('status', 'open')
      .order('severity', { ascending: false })
      .limit(5);

    if (exceptions) {
      const exceptionGroups: any = {};
      exceptions.forEach((ex: any) => {
        if (!exceptionGroups[ex.exception_type]) {
          exceptionGroups[ex.exception_type] = {
            type: ex.exception_type,
            count: 0,
            severity: ex.severity
          };
        }
        exceptionGroups[ex.exception_type].count++;
      });
      stats.topExceptions = Object.values(exceptionGroups);
    }

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching global fulfillment stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

