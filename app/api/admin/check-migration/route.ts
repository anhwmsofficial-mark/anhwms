/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { requirePermission } from '@/utils/rbac';

// GET: 마이그레이션 상태 확인
export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/admin/check-migration');
  try {
    await requirePermission('manage:orders', request);
    const checks: Record<string, any> = {};

    // 1. user_profiles 테이블 확인
    try {
      const { count: userProfilesCount, error: userProfilesError } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      checks.user_profiles = {
        exists: !userProfilesError,
        error: userProfilesError?.message,
        recordCount: userProfilesCount || 0,
      };
    } catch (err: any) {
      checks.user_profiles = {
        exists: false,
        error: err.message,
        recordCount: 0,
      };
    }

    // 2. org 테이블 확인
    try {
      const { error: orgError } = await supabaseAdmin
        .from('org')
        .select('id')
        .limit(1);

      checks.org = {
        exists: !orgError,
        error: orgError?.message,
      };
    } catch (err: any) {
      checks.org = {
        exists: false,
        error: err.message,
      };
    }

    // 3. customer_master 테이블 확인
    try {
      const { error: customerError } = await supabaseAdmin
        .from('customer_master')
        .select('id')
        .limit(1);

      checks.customer_master = {
        exists: !customerError,
        error: customerError?.message,
      };
    } catch (err: any) {
      checks.customer_master = {
        exists: false,
        error: err.message,
      };
    }

    // 4. brand 테이블 확인
    try {
      const { error: brandError } = await supabaseAdmin
        .from('brand')
        .select('id')
        .limit(1);

      checks.brand = {
        exists: !brandError,
        error: brandError?.message,
      };
    } catch (err: any) {
      checks.brand = {
        exists: false,
        error: err.message,
      };
    }

    // 5. warehouse 테이블 확인
    try {
      const { error: warehouseError } = await supabaseAdmin
        .from('warehouse')
        .select('id')
        .limit(1);

      checks.warehouse = {
        exists: !warehouseError,
        error: warehouseError?.message,
      };
    } catch (err: any) {
      checks.warehouse = {
        exists: false,
        error: err.message,
      };
    }

    // 6. 테스트 사용자 확인 (user_profiles가 있을 때만)
    if (checks.user_profiles.exists) {
      try {
        const { data: testUsers, error: testUsersError } = await supabaseAdmin
          .from('user_profiles')
          .select('email, role, can_access_admin, status')
          .in('email', [
            'mark.choi@anhwms.com',
            'golden.choi@anhwms.com',
            'claudia.park@anhwms.com',
          ]);

        checks.test_users = {
          exists: !testUsersError,
          count: testUsers?.length || 0,
          users: testUsers || [],
          error: testUsersError?.message,
        };
      } catch (err: any) {
        checks.test_users = {
          exists: false,
          count: 0,
          users: [],
          error: err.message,
        };
      }
    } else {
      checks.test_users = {
        exists: false,
        count: 0,
        users: [],
        error: 'user_profiles 테이블이 없습니다',
      };
    }

    return ok({
      success: true,
      checks,
      summary: {
        user_profiles: checks.user_profiles.exists ? '✅' : '❌',
        org: checks.org.exists ? '✅' : '❌',
        customer_master: checks.customer_master.exists ? '✅' : '❌',
        brand: checks.brand.exists ? '✅' : '❌',
        warehouse: checks.warehouse.exists ? '✅' : '❌',
        test_users: checks.test_users.count > 0 ? `✅ (${checks.test_users.count}명)` : '❌',
      },
    }, { requestId: ctx.requestId });
  } catch (error: any) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail('INTERNAL_ERROR', '마이그레이션 상태를 확인할 수 없습니다. Supabase 연결을 확인하세요.', {
      status: 500,
      requestId: ctx.requestId,
      details: error.message,
    });
  }
}

