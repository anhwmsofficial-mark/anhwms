import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api/response';
import { guardSmartstoreDetail, smartstoreErrorResponse } from '@/src/features/smartstore-detail/guard';
import { createDetailPreview, type PreviewProductInput } from '@/src/features/smartstore-detail/service';

export const maxDuration = 60;

const CHANNEL_NO = /^\d{5,20}$/;

async function productsFromForm(form: FormData): Promise<PreviewProductInput[]> {
  const parsed = JSON.parse(String(form.get('payload') || '[]')) as Array<{
    channelProductNo?: string;
    productName?: string;
    imageUrls?: string[];
  }>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('변환할 상품이 없습니다.');
  }
  const filesByChannel = new Map<string, File[]>();
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('images:') || !(value instanceof File) || value.size === 0) continue;
    const channelProductNo = key.slice('images:'.length);
    filesByChannel.set(channelProductNo, [...(filesByChannel.get(channelProductNo) || []), value]);
  }
  return Promise.all(parsed.map(async (product) => {
    const channelProductNo = String(product.channelProductNo || '').trim();
    if (!CHANNEL_NO.test(channelProductNo)) {
      throw new Error('채널 상품번호는 5~20자리 숫자여야 합니다.');
    }
    const files = filesByChannel.get(channelProductNo) || [];
    return {
      channelProductNo,
      productName: product.productName || null,
      imageUrls: Array.isArray(product.imageUrls) ? product.imageUrls.map(String) : [],
      files: await Promise.all(files.map(async (file) => ({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        bytes: Buffer.from(await file.arrayBuffer()),
      }))),
    };
  }));
}

async function productsFromJson(request: NextRequest): Promise<PreviewProductInput[]> {
  const body = await request.json() as { products?: Array<{ channelProductNo?: string; productName?: string; imageUrls?: string[] }> };
  const products = Array.isArray(body.products) ? body.products : [];
  return products.map((product) => ({
    channelProductNo: String(product.channelProductNo || ''),
    productName: product.productName || null,
    imageUrls: Array.isArray(product.imageUrls) ? product.imageUrls.map(String) : [],
  }));
}

export async function POST(request: NextRequest) {
  const access = await guardSmartstoreDetail(request, '/api/operations/smartstore-detail/preview');
  if (access.error) return access.error;
  try {
    const contentType = request.headers.get('content-type') || '';
    const products = contentType.includes('multipart/form-data')
      ? await productsFromForm(await request.formData())
      : await productsFromJson(request);
    if (products.length === 0) return fail('BAD_REQUEST', '변환할 상품이 없습니다.', { status: 400 });
    const job = await createDetailPreview({
      actorId: access.actorId || '',
      products,
      audit: access.audit || undefined,
    });
    return ok(job, { status: 201 });
  } catch (error) {
    return smartstoreErrorResponse(error);
  }
}
