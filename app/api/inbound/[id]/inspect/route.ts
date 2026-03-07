
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { AppApiError, ERROR_CODES, toAppApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/response';
import { saveInboundInspectionAndTransitionService } from '@/services/inbound/inboundService';

type InspectRequestLine = {
  receiptLineId?: string;
  planLineId?: string | null;
  productId?: string;
  expectedQty?: number;
  acceptedQty?: number;
  damagedQty?: number;
  note?: string | null;
  condition?: string | null;
};

function toSafeInteger(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function resolveCondition(line: InspectRequestLine, acceptedQty: number, damagedQty: number) {
  if (typeof line.condition === 'string' && line.condition.trim()) {
    return line.condition.trim().toUpperCase();
  }
  if (damagedQty > 0) return 'DAMAGED';
  if (acceptedQty > 0) return 'GOOD';
  return 'PENDING';
}

/**
 * 입고 검수 처리 API
 * POST /api/inbound/[id]/inspect
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // inbound_receipt_id
    const body = await req.json().catch(() => ({}));
    const {
      receivedQty,
      rejectedQty,
      condition,
      note,
      photos,
      completeInbound,
    } = body as {
      receivedQty?: number;
      rejectedQty?: number;
      condition?: string;
      note?: string;
      photos?: string[];
      completeInbound?: boolean;
      lines?: InspectRequestLine[];
    };

    // 1. 권한 체크
    await requirePermission('inventory:count', req);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 2. 입고 건 조회 (inbound_receipts)
    const { data: receipt, error: fetchError } = await supabase
      .from('inbound_receipts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !receipt) {
      return fail(ERROR_CODES.NOT_FOUND, 'Inbound receipt not found', { status: 404 });
    }

    // 중복 확정 방지 (상태 체크)
    if (['CONFIRMED', 'PUTAWAY_READY', 'CANCELLED'].includes(receipt.status)) {
        return fail(ERROR_CODES.BAD_REQUEST, '이미 확정되거나 취소된 입고 건은 수정할 수 없습니다.', { status: 400 });
    }

    // 3. 입고 라인 조회
    const { data: lines, error: linesError } = await supabase
      .from('inbound_receipt_lines')
      .select('*')
      .eq('receipt_id', id);

    if (linesError || !lines || lines.length === 0) {
        return fail(ERROR_CODES.BAD_REQUEST, 'No inbound lines found', { status: 400 });
    }

    const requestLines = Array.isArray((body as { lines?: InspectRequestLine[] }).lines)
      ? ((body as { lines?: InspectRequestLine[] }).lines as InspectRequestLine[])
      : null;

    let normalizedLines:
      | Array<{
          receipt_line_id: string;
          plan_line_id?: string | null;
          product_id: string;
          expected_qty: number;
          received_qty: number;
          damaged_qty: number;
          missing_qty: number;
          other_qty: number;
          notes?: string | null;
          condition?: string;
        }>
      | null = null;

    if (requestLines && requestLines.length > 0) {
      if (requestLines.length !== lines.length) {
        return fail(
          ERROR_CODES.BAD_REQUEST,
          '다품목 검수 저장 시 모든 라인을 함께 전송해야 합니다.',
          { status: 400 },
        );
      }

      const lineMap = new Map(lines.map((line) => [String(line.id), line]));

      normalizedLines = requestLines.map((line) => {
        const targetLine = line.receiptLineId ? lineMap.get(String(line.receiptLineId)) : null;
        if (!targetLine) {
          throw new AppApiError({
            error: '유효하지 않은 검수 라인이 포함되어 있습니다.',
            code: ERROR_CODES.BAD_REQUEST,
            status: 400,
          });
        }

        const acceptedQty = toSafeInteger(line.acceptedQty);
        const damagedQty = toSafeInteger(line.damagedQty);

        return {
          receipt_line_id: String(targetLine.id),
          plan_line_id: targetLine.plan_line_id,
          product_id: String(targetLine.product_id),
          expected_qty: Number(targetLine.expected_qty || 0),
          received_qty: acceptedQty,
          damaged_qty: damagedQty,
          missing_qty: 0,
          other_qty: 0,
          notes: line.note?.trim() || null,
          condition: resolveCondition(line, acceptedQty, damagedQty),
        };
      });
    } else {
      if (lines.length > 1) {
        return fail(
          ERROR_CODES.BAD_REQUEST,
          '다품목 입고 검수는 lines 배열 payload가 필요합니다.',
          { status: 400 },
        );
      }

      const targetLine = lines[0];
      const acceptedQty = toSafeInteger(receivedQty);
      const damagedQty = toSafeInteger(rejectedQty);

      normalizedLines = [
        {
          receipt_line_id: String(targetLine.id),
          plan_line_id: targetLine.plan_line_id,
          product_id: String(targetLine.product_id),
          expected_qty: Number(targetLine.expected_qty || 0),
          received_qty: acceptedQty,
          damaged_qty: damagedQty,
          missing_qty: 0,
          other_qty: 0,
          notes: typeof note === 'string' ? note.trim() || null : null,
          condition: resolveCondition({ condition }, acceptedQty, damagedQty),
        },
      ];
    }

    const result = await saveInboundInspectionAndTransitionService(
      supabase,
      user?.id,
      id,
      normalizedLines.map((line) => ({
        receipt_line_id: line.receipt_line_id,
        plan_line_id: line.plan_line_id,
        product_id: line.product_id,
        expected_qty: line.expected_qty,
        received_qty: line.received_qty,
        damaged_qty: line.damaged_qty,
        missing_qty: line.missing_qty,
        other_qty: line.other_qty,
        notes: line.notes || null,
      })),
      {
        requireFullLineSet: normalizedLines.length > 1,
        finalize: Boolean(completeInbound),
        inspectionEntries: normalizedLines.map((line) => ({
          product_id: line.product_id,
          expected_qty: line.expected_qty,
          received_qty: line.received_qty,
          rejected_qty: line.damaged_qty,
          condition: line.condition || 'GOOD',
          note: line.notes || null,
          photos: Array.isArray(photos) ? photos : [],
          inspected_at: new Date().toISOString(),
        })),
      },
    );

    if (completeInbound) {
      return ok({
        success: true,
        status: result.discrepancy ? 'DISCREPANCY' : 'PUTAWAY_READY',
        discrepancy: result.discrepancy,
      });
    }

    return ok({ success: true });

  } catch (error: unknown) {
    const apiError = toAppApiError(error, {
      error: '검수 처리 실패',
      code: ERROR_CODES.INTERNAL_ERROR,
      status: 500,
    });
    return fail(apiError.code || ERROR_CODES.INTERNAL_ERROR, apiError.message, {
      status: apiError.status,
      details: apiError.details,
    });
  }
}
