import 'server-only';

import type { NextRequest } from 'next/server';
import { getRequestId } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';

type ShareAuditAction = 'VIEW' | 'DOWNLOAD';
type ShareAuditResult = 'success' | 'denied' | 'password-fail';

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }
  return request.headers.get('x-real-ip')?.trim() || null;
}

export async function logShareAccessAudit(
  request: NextRequest,
  params: {
    action: ShareAuditAction;
    route: string;
    result: ShareAuditResult;
    actor?: string | null;
    reason?: string;
    shareId?: string | null;
    slug?: string | null;
  },
) {
  try {
    const requestId = getRequestId(request);
    const ip = getRequestIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const timestamp = new Date().toISOString();
    const actor = (params.actor || 'anonymous').trim() || 'anonymous';

    const db = createTrackedAdminClient({ route: 'share_audit' });
    const { error } = await db.from('audit_logs').insert({
      actor_id: null,
      actor_role: actor,
      action_type: params.action,
      resource_type: 'share_link',
      resource_id: params.shareId || params.slug || null,
      new_value: {
        timestamp,
        requestId,
        actor,
        route: params.route,
        shareId: params.shareId || null,
        slug: params.slug || null,
        ip,
        userAgent,
        result: params.result,
      },
      reason: params.reason || `${params.action.toLowerCase()}:${params.result}`,
      ip_address: ip,
      user_agent: userAgent,
    });

    if (error) {
      logger.error(error.message, {
        scope: 'share-audit',
        route: params.route,
        requestId,
        shareId: params.shareId || null,
        slug: params.slug || null,
      });
    }
  } catch (error) {
    logger.error(error as Error, {
      scope: 'share-audit',
      route: params.route,
      shareId: params.shareId || null,
      slug: params.slug || null,
    });
  }
}
