import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { parseAddress } from '@/services/address/parse';
import { pickCarrier } from '@/services/logistics/assign';
import { getDefaultSender } from '@/lib/api/orders';
import { requirePermission } from '@/utils/rbac';
import { createClient } from '@/utils/supabase/server';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { createRequestLogger } from '@/lib/api/request-log';
import { logger } from '@/lib/logger';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getErrorMessage } from '@/lib/errorHandler';
import { UPLOAD_POLICIES, validateUploadInput } from '@/lib/upload/validation';
import {
  createImportRowError,
  type DbClient,
  normalizeImportRowError,
  persistImportedOrder,
  syncImportedOrderToCJ,
} from '@/services/orders/importService';
import {
  ORDER_IMPORT_ERROR_CODES,
  type OrderImportErrorCode,
} from '@/lib/orders/importErrors';

type ImportSheetRow = Record<string, unknown>;
type ParsedImportRow = {
  orderNo: string;
  recvName: string;
  recvPhone: string;
  recvAddr: string;
  recvZip: string;
  productName: string;
  remark: string;
};
type ImportFailedItem = {
  orderNo: string;
  code: OrderImportErrorCode | string;
  reason: string;
};

type ImportValidationResult =
  | { ok: true }
  | { ok: false; code: OrderImportErrorCode; message: string };

const IMPORT_HEADERS = {
  orderNo: ['订单号', '주문번호'],
  recvName: ['收件人姓名', '수취인'],
  recvPhone: ['收件人电话', '전화번호'],
  recvAddr: ['收件地址', '주소'],
  recvZip: ['收件人邮编', '우편번호'],
  productName: ['商品名称', '상품명'],
  remark: ['备注', '비고'],
} as const;

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function isValidPhone(value: string): boolean {
  // Allow +, digits, spaces, dashes, parentheses and require at least 7 digits.
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && /^[+\d\s\-()]+$/.test(value);
}

function getCellValue(row: ImportSheetRow, keys: readonly string[]): string {
  for (const key of keys) {
    const raw = row[key];
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      return normalizeText(raw);
    }
  }
  return '';
}

function parseImportSheetRow(row: ImportSheetRow): ParsedImportRow {
  const productName = getCellValue(row, IMPORT_HEADERS.productName);
  return {
    orderNo: getCellValue(row, IMPORT_HEADERS.orderNo),
    recvName: getCellValue(row, IMPORT_HEADERS.recvName),
    recvPhone: getCellValue(row, IMPORT_HEADERS.recvPhone),
    recvAddr: getCellValue(row, IMPORT_HEADERS.recvAddr),
    recvZip: getCellValue(row, IMPORT_HEADERS.recvZip),
    productName: productName || '상품',
    remark: getCellValue(row, IMPORT_HEADERS.remark),
  };
}

function validateImportRow(input: {
  orderNo: string;
  recvName: string;
  recvPhone: string;
  recvAddr: string;
  recvZip: string;
  productName: string;
}): ImportValidationResult {
  const { orderNo, recvName, recvPhone, recvAddr, recvZip, productName } = input;
  if (!orderNo || !recvName || !recvPhone || !recvAddr) {
    return {
      ok: false,
      code: ORDER_IMPORT_ERROR_CODES.MISSING_REQUIRED,
      message: '필수값 누락 (주문번호, 수취인, 전화번호, 주소)',
    };
  }
  if (orderNo.length > 80) {
    return {
      ok: false,
      code: ORDER_IMPORT_ERROR_CODES.ORDER_NO_TOO_LONG,
      message: '주문번호 길이 초과(최대 80자)',
    };
  }
  if (recvName.length > 100) {
    return {
      ok: false,
      code: ORDER_IMPORT_ERROR_CODES.RECV_NAME_TOO_LONG,
      message: '수취인명 길이 초과(최대 100자)',
    };
  }
  if (!isValidPhone(recvPhone)) {
    return {
      ok: false,
      code: ORDER_IMPORT_ERROR_CODES.INVALID_PHONE,
      message: '전화번호 형식 오류',
    };
  }
  if (recvAddr.length > 500) {
    return {
      ok: false,
      code: ORDER_IMPORT_ERROR_CODES.ADDRESS_TOO_LONG,
      message: '주소 길이 초과(최대 500자)',
    };
  }
  if (recvZip && recvZip.length > 20) {
    return {
      ok: false,
      code: ORDER_IMPORT_ERROR_CODES.ZIP_TOO_LONG,
      message: '우편번호 길이 초과(최대 20자)',
    };
  }
  if (productName.length > 255) {
    return {
      ok: false,
      code: ORDER_IMPORT_ERROR_CODES.PRODUCT_NAME_TOO_LONG,
      message: '상품명 길이 초과(최대 255자)',
    };
  }
  return { ok: true };
}

/**
 * 주문 엑셀 업로드 & 자동 배송사 배정 API
 * 
 * POST /api/orders/import
 * - FormData로 Excel 파일 업로드
 * - 국가별 주소 파싱
 * - CJ/ANH/INTL 자동 배정
 * - CJ인 경우 브리지 API 호출
 */
export async function POST(req: NextRequest) {
  const ctx = getRouteContext(req, 'POST /api/orders/import');
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'orders_import_upload',
  });
  try {
    const rateLimitPerMinute = Math.max(1, Number.parseInt(process.env.RATE_LIMIT_ORDERS_IMPORT_PER_MINUTE || '10', 10));
    const rateLimit = await enforceRateLimit({
      request: req,
      scope: 'orders.import',
      limit: rateLimitPerMinute,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', {
        ...ctx,
        scope: 'rateLimit',
        rateLimitScope: 'orders.import',
        actorKeyType: rateLimit.actorKeyType,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt,
      });
      return fail('RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', {
        status: 429,
        requestId: ctx.requestId,
        headers: rateLimit.headers,
        details: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
      });
    }

    await requirePermission('manage:orders', req);
    const db = await createClient() as unknown as DbClient;
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return fail('BAD_REQUEST', '파일이 없습니다.', { status: 400, requestId: ctx.requestId });
    }
    validateUploadInput({
      fileName: file.name || 'orders-import.xlsx',
      mimeType: file.type,
      size: file.size,
      policy: UPLOAD_POLICIES.ordersSpreadsheet,
    });

    // Excel 파일 파싱
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ImportSheetRow>(sheet);

    if (rows.length === 0) {
      return fail('BAD_REQUEST', '엑셀 파일에 데이터가 없습니다.', { status: 400, requestId: ctx.requestId });
    }

    // 기본 발송인 정보 가져오기
    const sender = await getDefaultSender();

    let successCount = 0;
    const failed: ImportFailedItem[] = [];
    const seenOrderNos = new Set<string>();

    // 각 행 처리
    for (const r of rows) {
      try {
        const {
          orderNo,
          recvName,
          recvPhone,
          recvAddr,
          recvZip,
          productName,
          remark,
        } = parseImportSheetRow(r);

        const validation = validateImportRow({
          orderNo,
          recvName,
          recvPhone,
          recvAddr,
          recvZip,
          productName,
        });
        if (!validation.ok) {
          throw createImportRowError({
            code: validation.code,
            clientReason: validation.message,
            stage: 'validation',
            internalReason: validation.message,
          });
        }

        if (seenOrderNos.has(orderNo)) {
          throw createImportRowError({
            code: ORDER_IMPORT_ERROR_CODES.DUPLICATE_ORDER_NO,
            clientReason: '업로드 파일 내 중복 주문번호',
            stage: 'duplicate_check',
            internalReason: '업로드 파일 내 중복 주문번호',
          });
        }
        seenOrderNos.add(orderNo);

        // 주소 파싱
        const parsed = parseAddress(recvAddr, recvPhone, recvZip);

        // 배송사 자동 배정
        const carrier = pickCarrier(parsed.countryCode);

        const persisted = await persistImportedOrder(db, {
          orderNo,
          countryCode: parsed.countryCode,
          productName,
          remark,
          logisticsCompany: carrier,
          receiverName: recvName,
          receiverPhone: parsed.phoneIntl || recvPhone,
          receiverZip: parsed.postcode || recvZip,
          receiverAddress1: parsed.address1,
          receiverAddress2: parsed.address2,
          receiverLocality: parsed.locality || null,
          receiverCountryCode: parsed.countryCode,
          receiverMeta: parsed.countryCode === 'CN' ? { cn_mapped: parsed } : {},
        });

        // 외부 연동은 커밋 후 후처리로 분리한다.
        if (
          persisted.logisticsCompany === 'CJ' &&
          process.env.CJ_BRIDGE_BASE &&
          process.env.CJ_BRIDGE_SECRET
        ) {
          const syncResult = await syncImportedOrderToCJ(db, {
            orderId: persisted.orderId,
            orderNo,
            productName,
            remark,
            recvName,
            recvPhone: parsed.phoneIntl || recvPhone,
            recvZip: parsed.postcode || recvZip,
            address1: parsed.address1,
            address2: parsed.address2 || '',
            sender,
            bridgeBase: process.env.CJ_BRIDGE_BASE,
            bridgeSecret: process.env.CJ_BRIDGE_SECRET,
          });

          if (!syncResult.ok) {
            throw createImportRowError({
              code: ORDER_IMPORT_ERROR_CODES.EXTERNAL_SYNC_FAILED,
              clientReason: syncResult.reason,
              stage: 'external_sync',
              internalReason: syncResult.reason,
            });
          }
        }

        successCount++;
      } catch (e: unknown) {
        const rawOrderNo = getCellValue(r, IMPORT_HEADERS.orderNo);
        const importError = normalizeImportRowError(e);
        logger.warn('Order import row failed', {
          ...ctx,
          scope: 'orders.import',
          orderNo: rawOrderNo || '?',
          stage: importError.stage,
          code: importError.importCode,
          reason: importError.internalReason || importError.message,
        });
        failed.push({
          orderNo: rawOrderNo || '?',
          code: importError.importCode,
          reason: importError.clientReason,
        });
        continue;
      }
    }

    requestLog.success();
    return ok({
      successCount,
      failedCount: failed.length,
      failed: failed.slice(0, 50), // 최대 50개만 반환
    }, {
      requestId: ctx.requestId,
      headers: rateLimit.headers,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const apiError = requestLog.failure(error, {
      error: message || '업로드 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}

