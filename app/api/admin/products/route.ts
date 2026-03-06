import { NextRequest } from 'next/server';
import {
  createProductAction,
  deleteProductAction,
  listProductsAction,
  updateProductAction,
} from '@/app/actions/admin/products';
import { fail, ok } from '@/lib/api/response';

// GET: 상품 목록 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const result = await listProductsAction(
    {
      page: Number(searchParams.get('page') || 1),
      limit: Number(searchParams.get('limit') || 20),
      cursor: searchParams.get('cursor'),
      search: searchParams.get('search') || '',
      brand_id: searchParams.get('brand_id') || '',
      category: searchParams.get('category') || '',
      status: searchParams.get('status') || '',
    },
    request,
  );

  if (!result.ok) {
    if (result.code === 'SCHEMA_MISMATCH') {
      return fail(result.code, result.error, { status: result.status || 500 });
    }
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }

  return ok(result.data);
}

// POST: 상품 생성
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await createProductAction(body, request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data, { status: 201 });
}

// PATCH: 상품 수정
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const id = body?.id;
  const result = await updateProductAction(String(id || ''), body?.updates || {}, request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data, { status: 200 });
}

// DELETE: 상품 삭제
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  const result = await deleteProductAction(id, request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data, { status: 200 });
}

