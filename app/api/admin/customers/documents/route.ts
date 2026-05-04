import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api/response';
import { ensurePermission } from '@/lib/actions/auth';
import { createClient } from '@/utils/supabase/server';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { UPLOAD_POLICIES, validateUploadInput } from '@/lib/upload/validation';
import { randomUUID } from 'crypto';

const BUCKET = 'inbound';

export async function POST(request: NextRequest) {
  try {
    const permission = await ensurePermission('view:customers', request);
    if (!permission.ok) {
      return fail(permission.code || 'FORBIDDEN', permission.error || 'Forbidden', {
        status: permission.status || 403,
      });
    }

    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      return fail('UNAUTHORIZED', '인증이 필요합니다.', { status: 401 });
    }

    const { data: profile, error: profileError } = await db
      .from('user_profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile?.org_id) {
      return fail('FORBIDDEN', '조직 정보가 없는 계정은 파일을 업로드할 수 없습니다.', { status: 403 });
    }

    const orgId = String(profile.org_id);
    const formData = await request.formData();
    const file = formData.get('file');
    const kind = String(formData.get('kind') || '').trim();

    if (!(file instanceof File)) {
      return fail('BAD_REQUEST', '파일이 필요합니다.', { status: 400 });
    }
    if (kind !== 'business_license' && kind !== 'bankbook') {
      return fail('BAD_REQUEST', 'kind 값이 올바르지 않습니다.', { status: 400 });
    }

    const fileName = file.name || 'upload.bin';
    const buffer = Buffer.from(await file.arrayBuffer());
    validateUploadInput({
      fileName,
      mimeType: file.type,
      size: buffer.length,
      policy: UPLOAD_POLICIES.customerPartnerDocument,
    });

    const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
    const safeExt = ['pdf', 'jpg', 'jpeg', 'png'].includes(ext) ? ext : 'bin';
    const storagePath = `customer-docs/${orgId}/staged/${kind}-${randomUUID()}.${safeExt}`;

    const admin = createTrackedAdminClient({ route: 'POST /api/admin/customers/documents' });
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (uploadError) {
      return fail('INTERNAL_ERROR', uploadError.message || '업로드에 실패했습니다.', { status: 500 });
    }

    return ok({ bucket: BUCKET, storage_path: storagePath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '업로드 처리 중 오류가 발생했습니다.';
    return fail('INTERNAL_ERROR', message, { status: 500 });
  }
}
