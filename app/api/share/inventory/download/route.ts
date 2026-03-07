import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { logShareAccessAudit } from '@/lib/shareAudit';
import { verifyPassword } from '@/lib/share';
import {
  buildInventoryVolumeWorkbookBuffer,
  INVENTORY_VOLUME_EXPORT_MAX_ROWS,
} from '@/lib/inventory-volume-query';
import {
  clearSharePasswordFailures,
  enforcePublicShareRateLimit,
  ensureSharePasswordBackoff,
  publicShareNotFoundError,
  publicSharePasswordError,
  registerSharePasswordFailure,
} from '@/lib/share/security';

type ShareRow = {
  customer_id: string;
  date_from: string | null;
  date_to: string | null;
  expires_at: string | null;
  password_hash: string | null;
  password_salt: string | null;
};

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function getErrorStatus(error: unknown) {
  return error instanceof Error && 'status' in error ? Number((error as any).status) : 500;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '공유 정보를 확인할 수 없습니다.';
}

async function buildDownloadResponse(request: NextRequest, slug: string, password: string) {
  const route = 'GET /api/share/inventory/download';
  await enforcePublicShareRateLimit(request, 'inventory', 'download', slug);

  const db = createAdminClient();
  const { data, error } = await db
    .from('inventory_volume_share')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    throw publicShareNotFoundError();
  }

  const share = data as ShareRow;
  if (isExpired(share.expires_at)) {
    await logShareAccessAudit(request, {
      action: 'DOWNLOAD',
      route,
      result: 'denied',
      shareId: data.id,
      slug,
      reason: 'share_expired',
    });
    return new Response('공유 링크가 만료되었습니다.', { status: 410 });
  }

  if (share.password_hash && share.password_salt) {
    await ensureSharePasswordBackoff(request, 'inventory', slug);
    if (!password) {
      await logShareAccessAudit(request, {
        action: 'DOWNLOAD',
        route,
        result: 'password-fail',
        shareId: data.id,
        slug,
        reason: 'share_password_missing',
      });
      throw publicSharePasswordError();
    }
    const verified = verifyPassword(password, share.password_salt, share.password_hash);
    if (!verified) {
      const failure = await registerSharePasswordFailure(request, 'inventory', slug);
      await logShareAccessAudit(request, {
        action: 'DOWNLOAD',
        route,
        result: 'password-fail',
        shareId: data.id,
        slug,
        reason: `share_password_verification_failed:${failure.failureCount}`,
      });
      throw publicSharePasswordError();
    }
    await clearSharePasswordFailures(request, 'inventory', slug);
  }

  let workbookResult;
  try {
    workbookResult = await buildInventoryVolumeWorkbookBuffer(
      db,
      {
        customerId: share.customer_id,
        dateFrom: share.date_from,
        dateTo: share.date_to,
      },
      'sheet_name, header_order, raw_data',
      { maxRows: INVENTORY_VOLUME_EXPORT_MAX_ROWS },
    );
  } catch (error) {
    await logShareAccessAudit(request, {
      action: 'DOWNLOAD',
      route,
      result: 'denied',
      shareId: data.id,
      slug,
      reason: 'share_download_query_failed',
    });
    return new Response(
      error instanceof Error ? error.message : '공유 다운로드 조회에 실패했습니다.',
      { status: 500 },
    );
  }
  if (!workbookResult.buffer) {
    await logShareAccessAudit(request, {
      action: 'DOWNLOAD',
      route,
      result: 'denied',
      shareId: data.id,
      slug,
      reason: 'share_download_empty',
    });
    return new Response('다운로드할 데이터가 없습니다.', { status: 404 });
  }
  await logShareAccessAudit(request, {
    action: 'DOWNLOAD',
    route,
    result: 'success',
    shareId: data.id,
    slug,
    reason: 'share_download_success',
  });
  return new Response(workbookResult.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="inventory_shared_${slug}.xlsx"`,
      'X-Inventory-Export-Row-Count': String(workbookResult.totalFetched),
      'X-Inventory-Export-Truncated': String(workbookResult.truncated),
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = String(searchParams.get('slug') || '').trim();
  // Legacy support: older shared links pass the password in the query string.
  // Newer clients use POST with a JSON body, but both paths keep the same
  // validation flow inside buildDownloadResponse().
  const password = String(searchParams.get('password') || '').trim();
  if (!slug) {
    return new Response('slug가 필요합니다.', { status: 400 });
  }

  try {
    return await buildDownloadResponse(request, slug, password);
  } catch (error: unknown) {
    return new Response(getErrorMessage(error), { status: getErrorStatus(error) });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const slug = String(body?.slug || '').trim();
  const password = String(body?.password || '').trim();
  if (!slug) {
    return new Response('slug가 필요합니다.', { status: 400 });
  }

  try {
    return await buildDownloadResponse(request, slug, password);
  } catch (error: unknown) {
    return new Response(getErrorMessage(error), { status: getErrorStatus(error) });
  }
}
