import { sendAlertToChannels } from '@/lib/alerts/notifyChannels';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const DEFAULT_SETTINGS = {
  enabled: true,
  channels: ['notification', 'slack', 'email', 'kakao'],
  notify_roles: ['admin'],
  notify_users: [],
  cooldown_minutes: 1440,
};

type AlertSettingsRow = {
  enabled?: boolean | null;
  channels?: string[] | null;
  notify_roles?: string[] | null;
  notify_users?: string[] | null;
  cooldown_minutes?: number | null;
};
type ProductRow = Pick<Database['public']['Tables']['products']['Row'], 'id' | 'name' | 'sku' | 'min_stock'>;
type UserProfileRow = Pick<Database['public']['Tables']['user_profiles']['Row'], 'id'>;
type QuantityRow = { product_id: string; qty_on_hand: number | null };
type PendingReceiptRow = { plan_id: string | null };
type PlanLineRow = { product_id: string; expected_qty: number | null };

export async function checkLowStock(db: SupabaseClient<Database>) {
  const dbUntyped = db as unknown as {
    from: (table: string) => any;
  };
  const { data: settingsRow } = await dbUntyped
    .from('alert_settings')
    .select('*')
    .eq('alert_key', 'low_stock')
    .maybeSingle();
  const settings = { ...DEFAULT_SETTINGS, ...((settingsRow as AlertSettingsRow | null) || {}) };
  if (!settings.enabled) return { count: 0, disabled: true };

  const { data: products } = await dbUntyped
    .from('products')
    .select('id, name, sku, min_stock')
    .gt('min_stock', 0);

  const productRows: ProductRow[] = products || [];
  const productIds = productRows.map((p) => p.id).filter(Boolean);
  if (productIds.length === 0) return { count: 0 };

  const { data: qtyRows } = await dbUntyped
    .from('inventory_quantities')
    .select('product_id, qty_on_hand')
    .in('product_id', productIds);

  const qtyMap: Record<string, number> = {};
  ((qtyRows || []) as QuantityRow[]).forEach((row: QuantityRow) => {
    qtyMap[row.product_id] = (qtyMap[row.product_id] || 0) + (row.qty_on_hand || 0);
  });

  const { data: pendingReceipts } = await dbUntyped
    .from('inbound_receipts')
    .select('plan_id')
    .in('status', ['ARRIVED', 'PHOTO_REQUIRED', 'COUNTING', 'INSPECTING']);
  const planIds = Array.from(
    new Set(
      ((pendingReceipts || []) as PendingReceiptRow[])
        .map((r: PendingReceiptRow) => r.plan_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  const expectedMap: Record<string, number> = {};
  if (planIds.length > 0) {
    const { data: planLines } = await dbUntyped
      .from('inbound_plan_lines')
      .select('product_id, expected_qty')
      .in('plan_id', planIds);
    ((planLines || []) as PlanLineRow[]).forEach((row: PlanLineRow) => {
      expectedMap[row.product_id] = (expectedMap[row.product_id] || 0) + (row.expected_qty || 0);
    });
  }

  const lowStock = productRows.filter((p) => (qtyMap[p.id] || 0) < (p.min_stock || 0));
  if (lowStock.length === 0) return { count: 0 };

  const cooldownMinutes = Number(settings.cooldown_minutes ?? DEFAULT_SETTINGS.cooldown_minutes);
  const since = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();
  const { data: existingNotifs } = await dbUntyped
    .from('notifications')
    .select('id')
    .eq('action', 'low_stock')
    .gte('created_at', since);

  if ((existingNotifs || []).length > 0) {
    return { count: lowStock.length, skipped: true };
  }

  const roleFilter = (settings.notify_roles || []).map((r: string) => `role.eq.${r}`).join(',');
  const { data: roleUsers } = roleFilter
    ? await dbUntyped.from('user_profiles').select('id').or(roleFilter)
    : { data: [] };
  const roleUserRows: UserProfileRow[] = roleUsers || [];
  const userIds = Array.from(
    new Set([...(roleUserRows || []).map((u) => u.id), ...((settings.notify_users || []) as string[])]),
  );

  const topList = lowStock
    .slice(0, 5)
    .map((p) => `${p.sku}(${qtyMap[p.id] || 0}/${p.min_stock || 0})`)
    .join(', ');

  if ((settings.channels || []).includes('notification') && userIds.length > 0) {
    await Promise.all(
      userIds.map((adminId) =>
        dbUntyped.from('notifications').insert({
          user_id: adminId,
          title: '재고 부족 경보',
          message: `${lowStock.length}개 품목 재고 부족. 예: ${topList}`,
          type: 'urgent',
          link_url: '/inventory',
          action: 'low_stock',
          metadata: {
            sku_list: lowStock.map((p) => p.sku),
            expected_inbound: expectedMap,
          },
        })
      )
    );
  }

  const externalChannels = (settings.channels || []).filter((c: string) => c !== 'notification') as Parameters<
    typeof sendAlertToChannels
  >[1];
  await sendAlertToChannels({
    title: '재고 부족 경보',
    message: `${lowStock.length}개 품목 재고 부족. 예: ${topList}`,
    type: 'urgent',
    data: { skuList: lowStock.map((p) => p.sku), expectedInbound: expectedMap },
  }, externalChannels);

  return { count: lowStock.length };
}
