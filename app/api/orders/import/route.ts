/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { parseAddress, splitTel3KR } from '@/services/address/parse';
import { pickCarrier } from '@/services/logistics/assign';
import { cjRegBookCall } from '@/services/logistics/cjClient';
import { supabase } from '@/lib/supabase';
import { getDefaultSender } from '@/lib/api/orders';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

type ImportValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function isValidPhone(value: string): boolean {
  // Allow +, digits, spaces, dashes, parentheses and require at least 7 digits.
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && /^[+\d\s\-()]+$/.test(value);
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
      code: 'MISSING_REQUIRED',
      message: '필수값 누락 (주문번호, 수취인, 전화번호, 주소)',
    };
  }
  if (orderNo.length > 80) {
    return { ok: false, code: 'ORDER_NO_TOO_LONG', message: '주문번호 길이 초과(최대 80자)' };
  }
  if (recvName.length > 100) {
    return { ok: false, code: 'RECV_NAME_TOO_LONG', message: '수취인명 길이 초과(최대 100자)' };
  }
  if (!isValidPhone(recvPhone)) {
    return { ok: false, code: 'INVALID_PHONE', message: '전화번호 형식 오류' };
  }
  if (recvAddr.length > 500) {
    return { ok: false, code: 'ADDRESS_TOO_LONG', message: '주소 길이 초과(최대 500자)' };
  }
  if (recvZip && recvZip.length > 20) {
    return { ok: false, code: 'ZIP_TOO_LONG', message: '우편번호 길이 초과(최대 20자)' };
  }
  if (productName.length > 255) {
    return { ok: false, code: 'PRODUCT_NAME_TOO_LONG', message: '상품명 길이 초과(최대 255자)' };
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
  try {
    await requirePermission('manage:orders', req);
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return fail('BAD_REQUEST', '파일이 없습니다.', { status: 400, requestId: ctx.requestId });
    }

    // Excel 파일 파싱
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    if (rows.length === 0) {
      return fail('BAD_REQUEST', '엑셀 파일에 데이터가 없습니다.', { status: 400, requestId: ctx.requestId });
    }

    // 기본 발송인 정보 가져오기
    const sender = await getDefaultSender();

    let successCount = 0;
    const failed: any[] = [];
    const seenOrderNos = new Set<string>();

    // 각 행 처리
    for (const r of rows) {
      try {
        // 필수 필드 추출 (중문 엑셀 헤더 기준)
        const orderNo = normalizeText(r['订单号'] || r['주문번호']);
        const recvName = normalizeText(r['收件人姓名'] || r['수취인']);
        const recvPhone = normalizeText(r['收件人电话'] || r['전화번호']);
        const recvAddr = normalizeText(r['收件地址'] || r['주소']);
        const recvZip = normalizeText(r['收件人邮编'] || r['우편번호']);
        const productName = normalizeText(r['商品名称'] || r['상품명'] || '상품');
        const remark = normalizeText(r['备注'] || r['비고']);

        const validation = validateImportRow({
          orderNo,
          recvName,
          recvPhone,
          recvAddr,
          recvZip,
          productName,
        });
        if (!validation.ok) {
          throw new Error(`${validation.code}:${validation.message}`);
        }

        if (seenOrderNos.has(orderNo)) {
          throw new Error('DUPLICATE_ORDER_NO:업로드 파일 내 중복 주문번호');
        }
        seenOrderNos.add(orderNo);

        // 중복 체크
        const { data: existing } = await supabase
          .from('orders')
          .select('id')
          .eq('order_no', orderNo)
          .maybeSingle();

        if (existing) {
          throw new Error('DUPLICATE_ORDER_NO:중복 주문번호');
        }

        // 주소 파싱
        const parsed = parseAddress(recvAddr, recvPhone, recvZip);

        // 배송사 자동 배정
        const carrier = pickCarrier(parsed.countryCode);

        // 주문 생성
        const { data: orderRow, error: oErr } = await supabase
          .from('orders')
          .insert({
            order_no: orderNo,
            country_code: parsed.countryCode,
            product_name: productName,
            remark,
            logistics_company: carrier,
            status: 'CREATED',
          })
          .select()
          .single();

        if (oErr) {
          if ((oErr as any)?.code === '23505') {
            throw new Error('DUPLICATE_ORDER_NO:중복 주문번호');
          }
          throw oErr;
        }

        // 수취인 정보 저장
        const { error: rcErr } = await supabase
          .from('order_receivers')
          .insert({
            order_id: orderRow.id,
            name: recvName,
            phone: parsed.phoneIntl || recvPhone,
            zip: parsed.postcode || recvZip,
            address1: parsed.address1,
            address2: parsed.address2,
            locality: parsed.locality || null,
            country_code: parsed.countryCode,
            meta:
              parsed.countryCode === 'CN'
                ? { cn_mapped: parsed }
                : {},
          });

        if (rcErr) throw rcErr;

        // CJ 배정이면 브리지 호출 (환경변수 체크)
        if (
          carrier === 'CJ' &&
          process.env.CJ_BRIDGE_BASE &&
          process.env.CJ_BRIDGE_SECRET
        ) {
          const tel = splitTel3KR(parsed.phoneIntl || recvPhone);
          const senderTel = splitTel3KR(sender.phone || '010-0000-0000');

          const payload = {
            order: {
              orderNo,
              trackingNo: '',
              items: [
                {
                  name: productName || 'Goods',
                  qty: 1,
                  unit: 'EA',
                  amountKRW: 15000,
                },
              ],
              remark,
              createdAt: new Date().toISOString(),
            },
            sender: {
              name: sender.name,
              tel: senderTel,
              zip: sender.zip || '',
              addr: sender.address || '',
              addrDetail: sender.addressDetail || '',
            },
            receiver: {
              name: recvName,
              tel,
              zip: parsed.postcode || recvZip,
              addr: parsed.address1,
              addrDetail: parsed.address2 || '',
            },
            options: {
              printFlag: '02',
              deliveryType: '01',
              boxType: '01',
              boxQty: 1,
              freight: 6250,
            },
          };

          const bridge = await cjRegBookCall(
            process.env.CJ_BRIDGE_BASE!,
            payload,
            process.env.CJ_BRIDGE_SECRET!
          );

          // 로그 저장
          await supabase.from('logistics_api_logs').insert({
            order_id: orderRow.id,
            adapter: 'CJ',
            direction: 'RESPONSE',
            status: bridge.data?.result ?? 'F',
            http_code: bridge.status,
            body: bridge.data,
          });

          if (bridge.data?.result !== 'S') {
            await supabase
              .from('orders')
              .update({ status: 'FAILED' })
              .eq('id', orderRow.id);
            throw new Error(
              bridge.data?.cj?.RESULT_DETAIL || 'CJ 전송 실패'
            );
          }

          // 성공 시 송장번호 업데이트
          await supabase
            .from('orders')
            .update({
              status: 'SYNCED',
              tracking_no: bridge.data.invoiceNo ?? null,
            })
            .eq('id', orderRow.id);
        }

        successCount++;
      } catch (e: any) {
        console.error('주문 처리 실패:', r['订单号'] || r['주문번호'], e);
        const message = String(e?.message || 'UNKNOWN_ERROR:알 수 없는 오류');
        const [code, ...rest] = message.split(':');
        const normalizedCode = rest.length > 0 ? code : 'IMPORT_ROW_ERROR';
        const normalizedMessage = rest.length > 0 ? rest.join(':').trim() : message;
        failed.push({
          orderNo: r['订单号'] || r['주문번호'] || '?',
          code: normalizedCode,
          reason: normalizedMessage,
        });
        continue;
      }
    }

    return ok({
      successCount,
      failedCount: failed.length,
      failed: failed.slice(0, 50), // 최대 50개만 반환
    }, { requestId: ctx.requestId });
  } catch (error: any) {
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', error.message || '업로드 실패', {
      status,
      requestId: ctx.requestId,
    });
  }
}

