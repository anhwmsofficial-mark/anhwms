'use server';

import { createClient } from '@/utils/supabase/server';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { revalidatePath } from 'next/cache';

async function requireOpsAdmin(options?: { requireAdmin?: boolean }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: '인증이 필요합니다.' };

    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role, can_access_admin, can_manage_inventory, status, org_id')
        .eq('id', user.id)
        .maybeSingle();

    if (error || !profile) return { error: '권한 정보를 확인할 수 없습니다.' };
    if (profile.status && profile.status !== 'active') return { error: '계정이 비활성화되었습니다.' };

    const isAdmin = profile.role === 'admin' || profile.can_access_admin;
    if (options?.requireAdmin) {
        if (!isAdmin) return { error: '슈퍼관리자만 접근할 수 있습니다.' };
    }

    const allowedRoles = ['admin', 'manager', 'staff', 'operator'];
    const allowed =
        isAdmin ||
        profile.can_manage_inventory ||
        allowedRoles.includes(profile.role);

    if (!allowed) return { error: '재고/입고 권한이 없습니다.' };

    return { supabase, user, profile };
}

// 사진 목록 조회
export async function getInboundPhotos(
    receiptId: string,
    slotId: string,
    options?: { requireAdmin?: boolean }
) {
    const access = await requireOpsAdmin(options);
    if ('error' in access) return [];
    const { supabase, profile } = access;
    const db: any = options?.requireAdmin
        ? createTrackedAdminClient({ route: 'inbound_photo_action', action: 'getInboundPhotos' })
        : supabase;

    const { data, error } = await db
        .from('inbound_photos')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('receipt_id', receiptId)
        .eq('slot_id', slotId)
        .eq('is_deleted', false)
        .order('uploaded_at', { ascending: false });

    if (error) return [];
    const safePhotos = Array.isArray(data) ? data : [];

    return safePhotos.map(photo => ({
        ...photo,
        url: db.storage
            .from(photo.storage_bucket || 'inbound')
            .getPublicUrl(photo.storage_path).data.publicUrl
    }));
}

// 사진 삭제 (Soft Delete)
export async function deleteInboundPhoto(
    photoId: string,
    receiptId: string,
    options?: { requireAdmin?: boolean }
) {
    const access = await requireOpsAdmin(options);
    if ('error' in access) return { error: access.error };
    const { supabase, profile } = access;
    const db: any = options?.requireAdmin
        ? createTrackedAdminClient({ route: 'inbound_photo_action', action: 'deleteInboundPhoto' })
        : supabase;
    
    // DB 업데이트
    const { error } = await db
        .from('inbound_photos')
        .update({ is_deleted: true })
        .eq('org_id', profile.org_id)
        .eq('id', photoId);
        
    if (error) return { error: error.message };
    
    revalidatePath(`/ops/inbound/${receiptId}`);
    revalidatePath(`/inbound/${receiptId}`);
    return { success: true };
}
