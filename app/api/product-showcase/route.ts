import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensurePermission } from '@/lib/actions/auth';
import { fail, ok } from '@/lib/api/response';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { UPLOAD_POLICIES, validateUploadInput } from '@/lib/upload/validation';
import { createClient } from '@/utils/supabase/server';

const BUCKET = 'product-showcase';
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_IMAGES = 30;
// This table is introduced by the migration in this change and is not in the
// checked-in generated database types until those types are regenerated.
const showcaseDb = supabaseAdmin as unknown as SupabaseClient;

type ShowcaseRow = {
  id: string;
  product_key: string | null;
  display_name: string;
  management_name: string | null;
  category: string | null;
  images: string[];
  thumbnail_url: string;
  updated_at: string;
};

function toPublicItem(row: ShowcaseRow) {
  return {
    id: row.id,
    key: row.product_key,
    excel_name: row.display_name,
    excel_mgmt: row.management_name,
    cat: row.category,
    images: row.images,
    thumb: row.thumbnail_url,
    source: 'admin' as const,
    updated_at: row.updated_at,
  };
}

function storagePathFromPublicUrl(url: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
}

async function requireInventoryAccess(request: NextRequest) {
  const permission = await ensurePermission('inventory:count', request);
  if (!permission.ok) {
    return {
      response: fail(permission.code || 'FORBIDDEN', permission.error, {
        status: permission.status || 403,
      }),
      userId: null,
    };
  }

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    return {
      response: fail('UNAUTHORIZED', '인증이 필요합니다.', { status: 401 }),
      userId: null,
    };
  }
  return { response: null, userId: user.id };
}

export async function GET() {
  const { data, error } = await showcaseDb
    .from('product_showcase_items')
    .select('id, product_key, display_name, management_name, category, images, thumbnail_url, updated_at')
    .order('display_name', { ascending: true });

  if (error) {
    if (error.code === '42P01') {
      return ok([]);
    }
    return fail('INTERNAL_ERROR', '등록 상품 목록을 불러오지 못했습니다.', { status: 500 });
  }

  return ok(((data || []) as ShowcaseRow[]).map(toPublicItem), {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  });
}

export async function POST(request: NextRequest) {
  const access = await requireInventoryAccess(request);
  if (access.response) return access.response;

  const uploadedPaths: string[] = [];
  try {
    const formData = await request.formData();
    const id = String(formData.get('id') || '').trim();
    const displayName = String(formData.get('display_name') || '').trim();
    const productKey = String(formData.get('product_key') || displayName).trim();
    const managementName = String(formData.get('management_name') || '').trim() || null;
    const category = String(formData.get('category') || '').trim() || null;
    const files = formData.getAll('images').filter((value): value is File => value instanceof File);

    if (!ID_PATTERN.test(id)) {
      return fail('VALIDATION_ERROR', '상품 ID는 영문, 숫자, -, _ 조합 1~64자로 입력해 주세요.', { status: 400 });
    }
    if (!displayName || displayName.length > 200) {
      return fail('VALIDATION_ERROR', '상품명은 1~200자로 입력해 주세요.', { status: 400 });
    }
    if (files.length < 1 || files.length > MAX_IMAGES) {
      return fail('VALIDATION_ERROR', `이미지는 상품당 1~${MAX_IMAGES}개까지 등록할 수 있습니다.`, { status: 400 });
    }

    const publicUrls: string[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const buffer = Buffer.from(await file.arrayBuffer());
      const validated = validateUploadInput({
        fileName: file.name,
        mimeType: file.type,
        size: buffer.length,
        policy: UPLOAD_POLICIES.productShowcaseImage,
      });
      const path = `${id}/${randomUUID()}-${String(index + 1).padStart(2, '0')}.${validated.extension}`;
      const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
        contentType: file.type,
        upsert: false,
        cacheControl: '31536000',
      });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);
      publicUrls.push(supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }

    const { data: previous } = await showcaseDb
      .from('product_showcase_items')
      .select('images')
      .eq('id', id)
      .maybeSingle();

    const { data, error } = await showcaseDb
      .from('product_showcase_items')
      .upsert(
        {
          id,
          product_key: productKey || null,
          display_name: displayName,
          management_name: managementName,
          category,
          images: publicUrls,
          thumbnail_url: publicUrls[0],
          created_by: access.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select('id, product_key, display_name, management_name, category, images, thumbnail_url, updated_at')
      .single();

    if (error) throw error;

    const oldPaths = (Array.isArray(previous?.images) ? previous.images : [])
      .map((url) => storagePathFromPublicUrl(String(url)))
      .filter((path): path is string => path !== null && !uploadedPaths.includes(path));
    if (oldPaths.length) {
      await supabaseAdmin.storage.from(BUCKET).remove(oldPaths);
    }

    return ok(toPublicItem(data as ShowcaseRow), { status: 201 });
  } catch (error: unknown) {
    if (uploadedPaths.length) {
      await supabaseAdmin.storage.from(BUCKET).remove(uploadedPaths);
    }
    const message = error instanceof Error ? error.message : '이미지 등록에 실패했습니다.';
    return fail('INTERNAL_ERROR', message, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireInventoryAccess(request);
  if (access.response) return access.response;

  const id = new URL(request.url).searchParams.get('id')?.trim() || '';
  if (!ID_PATTERN.test(id)) {
    return fail('BAD_REQUEST', '올바른 상품 ID가 필요합니다.', { status: 400 });
  }

  const { data: previous } = await showcaseDb
    .from('product_showcase_items')
    .select('images')
    .eq('id', id)
    .maybeSingle();
  const { error } = await showcaseDb.from('product_showcase_items').delete().eq('id', id);
  if (error) {
    return fail('INTERNAL_ERROR', '상품을 삭제하지 못했습니다.', { status: 500 });
  }

  const paths = (Array.isArray(previous?.images) ? previous.images : [])
    .map((url) => storagePathFromPublicUrl(String(url)))
    .filter((path): path is string => Boolean(path));
  if (paths.length) await supabaseAdmin.storage.from(BUCKET).remove(paths);

  return ok({ id });
}
