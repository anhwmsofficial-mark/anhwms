import { splitTel3KR } from '@/services/address/parse';
import { cjRegBookCall } from '@/services/logistics/cjClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { logger } from '@/lib/logger';
import { ORDER_IMPORT_ERROR_CODES } from '@/lib/orders/importErrors';

export type DbClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => any;
};

type ImportRpcResult = {
  success?: boolean;
  order_id?: string;
  logistics_company?: string;
  failed_stage?: string;
  error_code?: string;
  error_message?: string;
};

export type ImportRowStage =
  | 'validation'
  | 'duplicate_check'
  | 'transaction'
  | 'order_insert'
  | 'recipient_insert'
  | 'external_sync'
  | 'unknown';

export type ImportRowError = Error & {
  importCode: string;
  clientReason: string;
  stage: ImportRowStage;
  internalReason?: string;
};

export type PersistImportedOrderInput = {
  orderNo: string;
  countryCode: string;
  productName: string;
  remark: string;
  logisticsCompany: string;
  receiverName: string;
  receiverPhone: string;
  receiverZip: string;
  receiverAddress1: string;
  receiverAddress2: string;
  receiverLocality: string | null;
  receiverCountryCode: string;
  receiverMeta: Record<string, unknown>;
};

export type PersistImportedOrderResult = {
  orderId: string;
  logisticsCompany: string;
};

export type CjSyncInput = {
  orderId: string;
  orderNo: string;
  productName: string;
  remark: string;
  recvName: string;
  recvPhone: string;
  recvZip: string;
  address1: string;
  address2: string;
  sender: {
    name: string;
    phone?: string | null;
    zip?: string | null;
    address?: string | null;
    addressDetail?: string | null;
  };
  bridgeBase: string;
  bridgeSecret: string;
};

export type CjSyncResult =
  | { ok: true; trackingNo: string | null }
  | { ok: false; reason: string };

export function createImportRowError(params: {
  code: string;
  clientReason: string;
  stage: ImportRowStage;
  internalReason?: string;
  cause?: unknown;
}): ImportRowError {
  const error = new Error(params.internalReason || params.clientReason) as ImportRowError;
  error.importCode = params.code;
  error.clientReason = params.clientReason;
  error.stage = params.stage;
  error.internalReason = params.internalReason;
  if (params.cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = params.cause;
  }
  return error;
}

function mapRpcStage(stage: string | undefined): ImportRowStage {
  switch (stage) {
    case 'order_insert':
      return 'order_insert';
    case 'recipient_insert':
      return 'recipient_insert';
    default:
      return 'transaction';
  }
}

function isImportRowError(error: unknown): error is ImportRowError {
  return typeof error === 'object' && error !== null && 'importCode' in error && 'stage' in error;
}

export function normalizeImportRowError(error: unknown): ImportRowError {
  if (isImportRowError(error)) {
    return error;
  }

  const message = getErrorMessage(error) || '알 수 없는 오류';
  return createImportRowError({
    code: ORDER_IMPORT_ERROR_CODES.IMPORT_ROW_ERROR,
    clientReason: '주문 저장 중 오류가 발생했습니다.',
    stage: 'unknown',
    internalReason: message,
    cause: error,
  });
}

export async function persistImportedOrder(
  db: DbClient,
  input: PersistImportedOrderInput,
): Promise<PersistImportedOrderResult> {
  const { data, error } = await db.rpc('import_order_with_receiver', {
    p_order_no: input.orderNo,
    p_country_code: input.countryCode,
    p_product_name: input.productName,
    p_remark: input.remark,
    p_logistics_company: input.logisticsCompany,
    p_status: 'CREATED',
    p_receiver_name: input.receiverName,
    p_receiver_phone: input.receiverPhone,
    p_receiver_zip: input.receiverZip,
    p_receiver_address1: input.receiverAddress1,
    p_receiver_address2: input.receiverAddress2,
    p_receiver_locality: input.receiverLocality,
    p_receiver_country_code: input.receiverCountryCode,
    p_receiver_meta: input.receiverMeta,
  });

  if (error) {
    throw createImportRowError({
      code: ORDER_IMPORT_ERROR_CODES.IMPORT_ROW_ERROR,
      clientReason: '주문 저장 중 오류가 발생했습니다.',
      stage: 'transaction',
      internalReason: getErrorMessage(error),
      cause: error,
    });
  }

  const result = (data || {}) as ImportRpcResult;
  if (!result.success || !result.order_id) {
    const code = result.error_code || ORDER_IMPORT_ERROR_CODES.IMPORT_ROW_ERROR;
    const stage = mapRpcStage(result.failed_stage);
    const clientReason =
      code === ORDER_IMPORT_ERROR_CODES.DUPLICATE_ORDER_NO
        ? '중복 주문번호'
        : stage === 'recipient_insert'
          ? '수취인 저장 중 오류가 발생했습니다.'
          : '주문 저장 중 오류가 발생했습니다.';

    throw createImportRowError({
      code,
      clientReason,
      stage,
      internalReason: result.error_message || '트랜잭션 처리 실패',
    });
  }

  return {
    orderId: result.order_id,
    logisticsCompany: result.logistics_company || input.logisticsCompany,
  };
}

async function insertLogisticsLog(
  db: DbClient,
  input: {
    orderId: string;
    direction: 'REQUEST' | 'RESPONSE';
    status: string;
    httpCode?: number;
    body: unknown;
  },
) {
  const { error } = await db.from('logistics_api_logs').insert({
    order_id: input.orderId,
    adapter: 'CJ',
    direction: input.direction,
    status: input.status,
    http_code: input.httpCode ?? null,
    body: input.body,
  });

  if (error) {
    logger.warn('Failed to persist logistics API log', {
      scope: 'orders.import',
      orderId: input.orderId,
      direction: input.direction,
      status: input.status,
      error: getErrorMessage(error),
    });
  }
}

export async function syncImportedOrderToCJ(
  db: DbClient,
  input: CjSyncInput,
): Promise<CjSyncResult> {
  const tel = splitTel3KR(input.recvPhone);
  const senderTel = splitTel3KR(input.sender.phone || '010-0000-0000');

  const payload = {
    order: {
      orderNo: input.orderNo,
      trackingNo: '',
      items: [
        {
          name: input.productName || 'Goods',
          qty: 1,
          unit: 'EA',
          amountKRW: 15000,
        },
      ],
      remark: input.remark,
      createdAt: new Date().toISOString(),
    },
    sender: {
      name: input.sender.name,
      tel: senderTel,
      zip: input.sender.zip || '',
      addr: input.sender.address || '',
      addrDetail: input.sender.addressDetail || '',
    },
    receiver: {
      name: input.recvName,
      tel,
      zip: input.recvZip,
      addr: input.address1,
      addrDetail: input.address2 || '',
    },
    options: {
      printFlag: '02',
      deliveryType: '01',
      boxType: '01',
      boxQty: 1,
      freight: 6250,
    },
  };

  await insertLogisticsLog(db, {
    orderId: input.orderId,
    direction: 'REQUEST',
    status: 'PENDING',
    body: payload,
  });

  try {
    const bridge = await cjRegBookCall(input.bridgeBase, payload, input.bridgeSecret);

    await insertLogisticsLog(db, {
      orderId: input.orderId,
      direction: 'RESPONSE',
      status: bridge.data?.result ?? 'F',
      httpCode: bridge.status,
      body: bridge.data,
    });

    if (bridge.data?.result !== 'S') {
      await db
        .from('orders')
        .update({ status: 'FAILED' })
        .eq('id', input.orderId);

      logger.warn('CJ sync failed after order commit', {
        scope: 'orders.import',
        orderId: input.orderId,
        orderNo: input.orderNo,
        detail: bridge.data?.cj?.RESULT_DETAIL || bridge.data,
      });

      return {
        ok: false,
        reason: 'CJ 연동 실패',
      };
    }

    await db
      .from('orders')
      .update({
        status: 'SYNCED',
        tracking_no: bridge.data.invoiceNo ?? null,
      })
      .eq('id', input.orderId);

    return {
      ok: true,
      trackingNo: bridge.data.invoiceNo ?? null,
    };
  } catch (error) {
    await insertLogisticsLog(db, {
      orderId: input.orderId,
      direction: 'RESPONSE',
      status: 'ERROR',
      body: { message: getErrorMessage(error) },
    });

    await db
      .from('orders')
      .update({ status: 'FAILED' })
      .eq('id', input.orderId);

    logger.error(error as Error, {
      scope: 'orders.import',
      stage: 'external_sync',
      orderId: input.orderId,
      orderNo: input.orderNo,
    });

    return {
      ok: false,
      reason: 'CJ 연동 중 오류가 발생했습니다.',
    };
  }
}
