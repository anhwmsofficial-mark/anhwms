import { sendAlertToChannels } from '@/lib/alerts/notifyChannels';

const DEFAULT_SETTINGS = {
  enabled: true,
  channels: ['notification', 'slack', 'email', 'kakao'],
  notify_roles: ['admin'],
  notify_users: [],
  cooldown_minutes: 1440,
};

export async function checkLowStock(db: any) {
  const { data: settingsRow } = await db
    .from('alert_settings')
    .select('*')
    .eq('alert_key', 'low_stock')
    .maybeSingle();
  const settings = { ...DEFAULT_SETTINGS, ...(settingsRow || {}) };
  if (!settings.enabled) return { count: 0, disabled: true };

  const { data: products } = await db
    .from('products')
    .select('id, name, sku, min_stock');

  const { data: qtyRows } = await db
    .from('inventory_quantities')
    .select('product_id, qty_on_hand');

  const qtyMap: Record<string, number> = {};
  (qtyRows || []).forEach((row: any) => {
    qtyMap[row.product_id] = (qtyMap[row.product_id] || 0) + (row.qty_on_hand || 0);
  });

  const { data: pendingReceipts } = await db
    .from('inbound_receipts')
    .select('plan_id')
    .in('status', ['ARRIVED', 'PHOTO_REQUIRED', 'COUNTING', 'INSPECTING']);
  const planIds = Array.from(new Set((pendingReceipts || []).map((r: any) => r.plan_id).filter(Boolean)));
  const expectedMap: Record<string, number> = {};
  if (planIds.length > 0) {
    const { data: planLines } = await db
      .from('inbound_plan_lines')
      .select('product_id, expected_qty')
      .in('plan_id', planIds);
    (planLines || []).forEach((row: any) => {
      expectedMap[row.product_id] = (expectedMap[row.product_id] || 0) + (row.expected_qty || 0);
    });
  }

  const lowStock = (products || []).filter((p: any) => (qtyMap[p.id] || 0) < (p.min_stock || 0));
  if (lowStock.length === 0) return { count: 0 };

  const since = new Date(Date.now() - settings.cooldown_minutes * 60 * 1000).toISOString();
  const { data: existingNotifs } = await db
    .from('notifications')
    .select('id')
    .eq('action', 'low_stock')
    .gte('created_at', since);

  if ((existingNotifs || []).length > 0) {
    return { count: lowStock.length, skipped: true };
  }

  const roleFilter = (settings.notify_roles || []).map((r: string) => `role.eq.${r}`).join(',');
  const { data: roleUsers } = roleFilter
    ? await db.from('user_profiles').select('id').or(roleFilter)
    : { data: [] };
  const userIds = Array.from(new Set([...(roleUsers || []).map((u: any) => u.id), ...(settings.notify_users || [])]));

  const topList = lowStock
    .slice(0, 5)
    .map((p: any) => `${p.sku}(${qtyMap[p.id] || 0}/${p.min_stock || 0})`)
    .join(', ');

  if ((settings.channels || []).includes('notification') && userIds.length > 0) {
    await Promise.all(
      userIds.map((adminId) =>
        db.from('notifications').insert({
          user_id: adminId,
          title: '재고 부족 경보',
          message: `${lowStock.length}개 품목 재고 부족. 예: ${topList}`,
          type: 'urgent',
          link_url: '/inventory',
          action: 'low_stock',
          metadata: {
            sku_list: lowStock.map((p: any) => p.sku),
            expected_inbound: expectedMap,
          },
        })
      )
    );
  }

  const externalChannels = (settings.channels || []).filter((c: string) => c !== 'notification');
  await sendAlertToChannels({
    title: '재고 부족 경보',
    message: `${lowStock.length}개 품목 재고 부족. 예: ${topList}`,
    type: 'urgent',
    data: { skuList: lowStock.map((p: any) => p.sku), expectedInbound: expectedMap },
  }, externalChannels);

  return { count: lowStock.length };
}
