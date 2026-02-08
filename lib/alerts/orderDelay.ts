import { sendAlertToChannels } from '@/lib/alerts/notifyChannels';
import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SETTINGS = {
  enabled: true,
  channels: ['notification', 'slack', 'email', 'kakao'],
  notify_roles: ['admin'],
  notify_users: [],
  cooldown_minutes: 1440,
};

export async function checkOrderDelay(db: SupabaseClient, hours: number) {
  type OrderRow = {
    id: string;
    order_no: string;
    status: string;
    created_at: string;
  };
  type NotificationRow = { metadata?: { order_id?: string | null } | null };
  type UserRow = { id: string };

  const { data: settingsRow } = await db
    .from('alert_settings')
    .select('*')
    .eq('alert_key', 'order_delay')
    .maybeSingle();
  const settings = { ...DEFAULT_SETTINGS, ...(settingsRow || {}) };
  if (!settings.enabled) return { count: 0, disabled: true };

  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const delayedStatuses = ['CREATED', 'APPROVED', 'ALLOCATED', 'PICKED', 'PACKED'];
  const { data: orders } = await db
    .from('orders')
    .select('id, order_no, status, created_at')
    .in('status', delayedStatuses)
    .lt('created_at', threshold);

  if (!orders || (orders as OrderRow[]).length === 0) return { count: 0 };

  const since = new Date(Date.now() - settings.cooldown_minutes * 60 * 1000).toISOString();
  const { data: existingNotifs } = await db
    .from('notifications')
    .select('metadata')
    .eq('action', 'order_delay')
    .gte('created_at', since);

  const existingIds = new Set(
    ((existingNotifs as NotificationRow[] | null) || [])
      .map((n) => n?.metadata?.order_id)
      .filter(Boolean)
  );

  const delayedNew = (orders as OrderRow[]).filter((o) => !existingIds.has(o.id));
  if (delayedNew.length === 0) return { count: 0, skipped: true };

  const roleFilter = (settings.notify_roles || []).map((r: string) => `role.eq.${r}`).join(',');
  const { data: roleUsers } = roleFilter
    ? await db.from('user_profiles').select('id').or(roleFilter)
    : { data: [] };
  const userIds = Array.from(
    new Set([...(roleUsers as UserRow[] | null || []).map((u) => u.id), ...(settings.notify_users || [])])
  );

  const topList = delayedNew
    .slice(0, 5)
    .map((o) => `${o.order_no}(${o.status})`)
    .join(', ');

  if ((settings.channels || []).includes('notification') && userIds.length > 0) {
    await Promise.all(
      userIds.map((adminId) =>
        db.from('notifications').insert({
          user_id: adminId,
          title: '주문 처리 지연',
          message: `${delayedNew.length}건 지연 감지. 예: ${topList}`,
          type: 'warning',
          link_url: '/admin/orders',
          action: 'order_delay',
          metadata: {
            order_id: delayedNew[0]?.id,
            order_nos: delayedNew.map((o) => o.order_no),
          },
        })
      )
    );
  }

  const externalChannels = (settings.channels || []).filter((c: string) => c !== 'notification');
  await sendAlertToChannels(
    {
      title: '주문 처리 지연',
      message: `${delayedNew.length}건 지연 감지. 예: ${topList}`,
      type: 'warning',
      data: { orderIds: delayedNew.map((o) => o.id) },
    },
    externalChannels
  );

  return { count: delayedNew.length };
}
