import { NextRequest } from 'next/server';
import { createCustomerContractAction, listCustomerContractsAction } from '@/app/actions/admin/customer-details';
import { fail, ok } from '@/lib/api/response';

// 거래처 계약 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;
  const result = await listCustomerContractsAction(customerId, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

// 거래처 계약 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;
  const body = await req.json();
  const result = await createCustomerContractAction(customerId, body, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data, { status: 201 });
}

