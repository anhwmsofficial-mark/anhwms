import { sendAlertToChannels } from '@/lib/alerts/notifyChannels';

export async function checkInboundDelay(db: any, hours: number) {
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: receipts } = await db
    .from('inbound_receipts')
    .select('id, receipt_no, status, created_at, plan:plan_id(plan_no)')
    .in('status', ['ARRIVED', 'PHOTO_REQUIRED', 'COUNTING', 'INSPECTING'])
    .lt('created_at', threshold);

  const receiptIds = (receipts || []).map((r: any) => r.id);
  if (receiptIds.length === 0) return { count: 0 };

  const { data: ledgerRows } = await db
    .from('inventory_ledger')
    .select('reference_id')
    .eq('reference_type', 'INBOUND_RECEIPT')
    .in('reference_id', receiptIds);

  const reflected = new Set((ledgerRows || []).map((r: any) => r.reference_id));
  const delayed = (receipts || []).filter((r: any) => !reflected.has(r.id));
  if (delayed.length === 0) return { count: 0 };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existingNotifs } = await db
    .from('notifications')
    .select('metadata')
    .eq('action', 'inbound_delay')
    .gte('created_at', since);

  const existingIds = new Set(
    (existingNotifs || [])
      .map((n: any) => n?.metadata?.receipt_id)
      .filter(Boolean)
  );

  const { data: admins } = await db
    .from('user_profiles')
    .select('id')
    .or('role.eq.admin,can_access_admin.eq.true');

  const adminIds = (admins || []).map((a: any) => a.id);
  const newlyDelayed = delayed.filter((r: any) => !existingIds.has(r.id));
  if (newlyDelayed.length === 0) return { count: 0 };

  const firstList = newlyDelayed
    .slice(0, 5)
    .map((r: any) => `${r.receipt_no}(${r.plan?.plan_no || '-'})`)
    .join(', ');

  if (adminIds.length > 0) {
    await Promise.all(
      adminIds.map((adminId) =>
        db.from('notifications').insert({
          user_id: adminId,
          title: '입고→재고 반영 지연',
          message: `${newlyDelayed.length}건 지연 감지. 예: ${firstList}`,
          type: 'warning',
          link_url: '/inbound',
          action: 'inbound_delay',
          metadata: { receipt_id: newlyDelayed[0]?.id, receipt_nos: newlyDelayed.map((r: any) => r.receipt_no) },
        })
      )
    );
  }

  await sendAlertToChannels({
    title: '입고→재고 반영 지연',
    message: `${newlyDelayed.length}건 지연 감지. 예: ${firstList}`,
    type: 'warning',
    data: { receiptIds: newlyDelayed.map((r: any) => r.id) },
  });

  return { count: newlyDelayed.length };
}
