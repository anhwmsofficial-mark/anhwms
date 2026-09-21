import 'server-only';

import { AppApiError } from '@/lib/api/errors';

export const PARTNER_INBOUND_CUSTOMER_CODE = 'YBK';

export type PartnerInboundCustomer = {
  id: string;
  code: string;
  name: string;
  status: string | null;
};

export async function resolvePartnerInboundCustomer(
  db: any,
  orgId?: string | null,
): Promise<PartnerInboundCustomer> {
  let query = db
    .from('customer_master')
    .select('id, code, name, status')
    .eq('code', PARTNER_INBOUND_CUSTOMER_CODE);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new AppApiError({
      error: '고객사 정보를 확인할 수 없습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  }

  if (!data?.id) {
    throw new AppApiError({
      error: 'YBK 고객사를 찾을 수 없습니다.',
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  return data as PartnerInboundCustomer;
}
