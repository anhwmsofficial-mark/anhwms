import { createClient } from '@supabase/supabase-js';

export type InboundInspectEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
  adminEmail: string;
  adminPassword: string;
  readonlyReceiptId: string;
  foreignReceiptId: string;
};

export type AdminActorContext = {
  userId: string;
  orgId: string;
  email: string;
};

export type InboundLineFixture = {
  id: string;
  productId: string;
  expectedQty: number;
};

export type InboundReceiptFixture = {
  orgId: string;
  userId: string;
  warehouseId: string;
  clientId: string;
  productIds: string[];
  planId: string;
  receiptId: string;
  lines: InboundLineFixture[];
  cleanup: () => Promise<void>;
};

type FixtureOptions = {
  lineCount?: number;
  expectedQtys?: number[];
  initialStatus?: 'ARRIVED' | 'COUNTING' | 'INSPECTING' | 'DISCREPANCY' | 'CONFIRMED' | 'PUTAWAY_READY' | 'CANCELLED';
  requiredPhotoSlots?: Array<{
    slot_key: string;
    title: string;
    min_photos?: number;
  }>;
  attachPhotos?: boolean;
};

function nowToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getInboundInspectEnv(): InboundInspectEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    adminEmail: process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || '',
    adminPassword: process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || '',
    readonlyReceiptId: process.env.E2E_READONLY_RECEIPT_ID || '',
    foreignReceiptId: process.env.E2E_FOREIGN_RECEIPT_ID || '',
  };
}

export function createServiceRoleClient() {
  const env = getInboundInspectEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function resolveAdminActorContext() {
  const env = getInboundInspectEnv();
  if (!env.adminEmail) {
    throw new Error('E2E_ADMIN_EMAIL 또는 E2E_EMAIL 이 필요합니다.');
  }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('user_profiles')
    .select('id, org_id, email')
    .eq('email', env.adminEmail)
    .single();

  if (error || !data?.id || !data?.org_id) {
    throw new Error(error?.message || '관리자 user_profiles 조회에 실패했습니다.');
  }

  return {
    userId: String(data.id),
    orgId: String(data.org_id),
    email: String(data.email),
  } satisfies AdminActorContext;
}

export async function findReadableReceiptIdByLineMode(mode: 'single' | 'multi') {
  const db = createServiceRoleClient();
  const actor = await resolveAdminActorContext();

  const { data: receipts, error } = await db
    .from('inbound_receipts')
    .select('id, created_at')
    .eq('org_id', actor.orgId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  for (const receipt of receipts || []) {
    const { count, error: countError } = await db
      .from('inbound_receipt_lines')
      .select('id', { count: 'exact', head: true })
      .eq('receipt_id', receipt.id);

    if (countError) {
      continue;
    }

    if (mode === 'single' && count === 1) {
      return String(receipt.id);
    }

    if (mode === 'multi' && typeof count === 'number' && count > 1) {
      return String(receipt.id);
    }
  }

  return null;
}

export async function createInboundReceiptFixture(options: FixtureOptions = {}): Promise<InboundReceiptFixture> {
  const db = createServiceRoleClient();
  const actor = await resolveAdminActorContext();
  const token = nowToken();
  const lineCount = Math.max(1, options.lineCount ?? 1);
  const expectedQtys =
    Array.isArray(options.expectedQtys) && options.expectedQtys.length === lineCount
      ? options.expectedQtys
      : Array.from({ length: lineCount }, (_, index) => index + 5);

  const warehouseCode = `TWH-${token}`.slice(0, 20);
  const clientCode = `TCL-${token}`.slice(0, 20);

  const { data: warehouse, error: warehouseError } = await db
    .from('warehouse')
    .insert({
      org_id: actor.orgId,
      code: warehouseCode,
      name: `Inbound Test Warehouse ${token}`,
      type: 'ANH_OWNED',
      status: 'ACTIVE',
    })
    .select('id')
    .single();

  if (warehouseError || !warehouse?.id) {
    throw new Error(warehouseError?.message || '테스트 warehouse 생성 실패');
  }

  const { data: client, error: clientError } = await db
    .from('customer_master')
    .insert({
      org_id: actor.orgId,
      code: clientCode,
      name: `Inbound Test Client ${token}`,
      type: 'CLIENT_BRAND',
      status: 'ACTIVE',
    })
    .select('id')
    .single();

  if (clientError || !client?.id) {
    throw new Error(clientError?.message || '테스트 customer 생성 실패');
  }

  const productRows = Array.from({ length: lineCount }, (_, index) => ({
    name: `Inbound Inspect Product ${token}-${index + 1}`,
    sku: `ISP-${token}-${index + 1}`.slice(0, 50),
    category: 'TEST',
    quantity: 0,
    status: 'ACTIVE',
  }));

  const { data: products, error: productsError } = await db
    .from('products')
    .insert(productRows)
    .select('id');

  if (productsError || !products || products.length !== lineCount) {
    throw new Error(productsError?.message || '테스트 product 생성 실패');
  }

  const linesPayload = products.map((product, index) => ({
    product_id: product.id,
    expected_qty: expectedQtys[index],
    box_count: null,
    pallet_text: null,
    mfg_date: null,
    expiry_date: null,
    notes: `fixture-line-${index + 1}`,
    line_notes: null,
  }));

  const slotsPayload = (options.requiredPhotoSlots || []).map((slot, index) => ({
    slot_key: slot.slot_key,
    title: slot.title,
    is_required: true,
    min_photos: slot.min_photos ?? 1,
    sort_order: index,
  }));

  const planNo = `INP-T-${token}`.slice(0, 40);
  const receiptNo = `INR-T-${token}`.slice(0, 40);
  const { data: createResult, error: createError } = await db.rpc('create_inbound_plan_full', {
    p_org_id: actor.orgId,
    p_user_id: actor.userId,
    p_plan_no: planNo,
    p_receipt_no: receiptNo,
    p_plan_data: {
      warehouse_id: warehouse.id,
      client_id: client.id,
      planned_date: new Date().toISOString().slice(0, 10),
      inbound_manager: 'playwright',
      notes: 'tests/api/inbound-inspect.spec.ts',
    },
    p_lines: linesPayload,
    p_slots: slotsPayload,
  });

  if (createError || !createResult?.plan_id || !createResult?.receipt_id) {
    throw new Error(createError?.message || '테스트 inbound fixture 생성 실패');
  }

  const planId = String(createResult.plan_id);
  const receiptId = String(createResult.receipt_id);

  if (options.initialStatus && options.initialStatus !== 'ARRIVED') {
    const { error: statusError } = await db
      .from('inbound_receipts')
      .update({
        status: options.initialStatus,
        confirmed_at:
          options.initialStatus === 'CONFIRMED' || options.initialStatus === 'PUTAWAY_READY'
            ? new Date().toISOString()
            : null,
        confirmed_by:
          options.initialStatus === 'CONFIRMED' || options.initialStatus === 'PUTAWAY_READY'
            ? actor.userId
            : null,
      })
      .eq('id', receiptId);

    if (statusError) {
      throw new Error(statusError.message);
    }
  }

  if (options.attachPhotos && slotsPayload.length > 0) {
    const { data: slots, error: slotsError } = await db
      .from('inbound_photo_slots')
      .select('id')
      .eq('receipt_id', receiptId);

    if (slotsError) {
      throw new Error(slotsError.message);
    }

    if ((slots || []).length > 0) {
      const photoRows = (slots || []).map((slot, index) => ({
        org_id: actor.orgId,
        receipt_id: receiptId,
        slot_id: slot.id,
        storage_path: `tests/inbound/${token}/${index + 1}.jpg`,
        mime_type: 'image/jpeg',
        file_size: 1024,
        uploaded_by: actor.userId,
        is_deleted: false,
      }));

      const { error: photoError } = await db.from('inbound_photos').insert(photoRows);
      if (photoError) {
        throw new Error(photoError.message);
      }
    }
  }

  const { data: lines, error: linesError } = await db
    .from('inbound_receipt_lines')
    .select('id, product_id, expected_qty')
    .eq('receipt_id', receiptId)
    .order('created_at', { ascending: true });

  if (linesError || !lines || lines.length !== lineCount) {
    throw new Error(linesError?.message || '테스트 receipt lines 조회 실패');
  }

  const cleanup = async () => {
    await db.from('audit_logs').delete().eq('resource_id', receiptId);
    await db.from('audit_logs').delete().eq('resource_id', planId);
    await db.from('inventory_ledger').delete().eq('reference_id', receiptId);
    await db.from('inventory_quantities').delete().eq('warehouse_id', warehouse.id).in('product_id', products.map((product) => product.id));
    await db.from('inbound_inspections').delete().eq('inbound_id', receiptId);
    await db.from('inbound_events').delete().eq('receipt_id', receiptId);
    await db.from('inbound_photos').delete().eq('receipt_id', receiptId);
    await db.from('inbound_photo_slots').delete().eq('receipt_id', receiptId);
    await db.from('inbound_receipt_lines').delete().eq('receipt_id', receiptId);
    await db.from('inbound_receipts').delete().eq('id', receiptId);
    await db.from('inbound_plan_lines').delete().eq('plan_id', planId);
    await db.from('inbound_plans').delete().eq('id', planId);
    await db.from('products').delete().in('id', products.map((product) => product.id));
    await db.from('customer_master').delete().eq('id', client.id);
    await db.from('warehouse').delete().eq('id', warehouse.id);
  };

  return {
    orgId: actor.orgId,
    userId: actor.userId,
    warehouseId: String(warehouse.id),
    clientId: String(client.id),
    productIds: products.map((product) => String(product.id)),
    planId,
    receiptId,
    lines: lines.map((line) => ({
      id: String(line.id),
      productId: String(line.product_id),
      expectedQty: Number(line.expected_qty || 0),
    })),
    cleanup,
  };
}
