import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';

type ExceptionSummary = {
  type: string;
  count: number;
  severity: string;
};

export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/global-fulfillment/stats');
  try {
    await requirePermission('read:orders', request);
    // 전체 주문 수 조회
    const db = supabase as unknown as { from: (table: string) => any };
    const { data: ordersRaw, error: ordersError } = await db
      .from('global_fulfillment_orders')
      .select('*');
    const orders = (ordersRaw || []) as Array<{ status?: string | null; current_step?: string | null; origin_country?: string | null }>;

    if (ordersError) throw ordersError;

    // 통계 계산
    const stats: {
      totalOrders: number;
      pendingOrders: number;
      inProgressOrders: number;
      completedOrders: number;
      delayedOrders: number;
      exceptionOrders: number;
      byStep: Record<string, number>;
      byCountry: Record<string, number>;
      byCustomer: unknown[];
      topExceptions: ExceptionSummary[];
      recentActivity: unknown[];
    } = {
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
    const countryGroups: Record<string, number> = {};
    orders?.forEach(order => {
      const country = order.origin_country || 'Unknown';
      countryGroups[country] = (countryGroups[country] || 0) + 1;
    });
    stats.byCountry = countryGroups;

    // 이상 건수 조회
    const { data: exceptionsRaw } = await db
      .from('global_exceptions')
      .select('*')
      .eq('status', 'open')
      .order('severity', { ascending: false })
      .limit(5);
    const exceptions = (exceptionsRaw || []) as Array<{ exception_type: string; severity: string }>;

    if (exceptions) {
      const exceptionGroups: Record<string, ExceptionSummary> = {};
      exceptions.forEach((ex) => {
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

    return ok(stats, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message || 'Failed to fetch stats', {
      status,
      requestId: ctx.requestId,
    });
  }
}

