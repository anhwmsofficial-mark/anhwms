'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// 사진 목록 조회
export async function getInboundPhotos(receiptId: string, slotId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('inbound_photos')
        .select('*')
        .eq('receipt_id', receiptId)
        .eq('slot_id', slotId)
        .eq('is_deleted', false)
        .order('uploaded_at', { ascending: false });

    if (error) return [];
    
    // Signed URL 생성 (보안상 필요할 경우) 또는 Public URL 사용
    // 여기서는 Public URL 사용 가정 (Bucket이 Public일 경우)
    const { data: publicUrlData } = supabase.storage.from('inbound').getPublicUrl('');
    const baseUrl = publicUrlData.publicUrl;

    return data.map(photo => ({
        ...photo,
        url: `${baseUrl}/${photo.storage_path}`
    }));
}

// 사진 삭제 (Soft Delete)
export async function deleteInboundPhoto(photoId: string, receiptId: string) {
    const supabase = await createClient();
    
    // DB 업데이트
    const { error } = await supabase
        .from('inbound_photos')
        .update({ is_deleted: true })
        .eq('id', photoId);
        
    if (error) return { error: error.message };
    
    revalidatePath(`/ops/inbound/${receiptId}`);
    return { success: true };
}
