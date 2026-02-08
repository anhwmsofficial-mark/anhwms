'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

async function requireOpsAdmin(options?: { requireAdmin?: boolean }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: '인증이 필요합니다.' };

    if (options?.requireAdmin) {
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('role, can_access_admin, status')
            .eq('id', user.id)
            .maybeSingle();
        if (error || !profile) return { error: '권한 정보를 확인할 수 없습니다.' };
        if (profile.status && profile.status !== 'active') return { error: '계정이 비활성화되었습니다.' };
        const isAdmin = profile.role === 'admin' || profile.can_access_admin;
        if (!isAdmin) return { error: '슈퍼관리자만 접근할 수 있습니다.' };
    }

    return { supabase, user };
}

// 사진 목록 조회
export async function getInboundPhotos(
    receiptId: string,
    slotId: string,
    options?: { requireAdmin?: boolean }
) {
    const access = await requireOpsAdmin(options);
    if ('error' in access) return [];
    const { supabase } = access;
    const db = supabase;

    const { data, error } = await db
        .from('inbound_photos')
        .select('*')
        .eq('receipt_id', receiptId)
        .eq('slot_id', slotId)
        .eq('is_deleted', false)
        .order('uploaded_at', { ascending: false });

    if (error) return [];
    
    // Signed URL 생성 (보안상 필요할 경우) 또는 Public URL 사용
    // 여기서는 Public URL 사용 가정 (Bucket이 Public일 경우)
    const { data: publicUrlData } = db.storage.from('inbound').getPublicUrl('');
    const baseUrl = publicUrlData.publicUrl;

    return data.map(photo => ({
        ...photo,
        url: `${baseUrl}/${photo.storage_path}`
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
    const { supabase } = access;
    const db = supabase;
    
    // DB 업데이트
    const { error } = await db
        .from('inbound_photos')
        .update({ is_deleted: true })
        .eq('id', photoId);
        
    if (error) return { error: error.message };
    
    revalidatePath(`/ops/inbound/${receiptId}`);
    return { success: true };
}
