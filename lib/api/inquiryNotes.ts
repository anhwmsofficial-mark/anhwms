import supabaseAdmin from '@/lib/supabase-admin';
import { InquiryNote, CreateInquiryNoteInput } from '@/types';

function mapInquiryNoteRow(row: any): InquiryNote {
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    inquiryType: row.inquiry_type,
    adminId: row.admin_id,
    adminName: row.admin_name,
    note: row.note,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

/**
 * 견적 문의에 대한 메모 생성
 */
export async function createInquiryNote(
  input: CreateInquiryNoteInput,
  adminId: string,
): Promise<InquiryNote> {
  const payload = {
    inquiry_id: input.inquiryId,
    inquiry_type: input.inquiryType,
    admin_id: adminId,
    note: input.note.trim(),
  };

  const { data, error } = await supabaseAdmin
    .from('inquiry_notes')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('[createInquiryNote] insert failed', error);
    throw new Error('메모 저장에 실패했습니다.');
  }

  return mapInquiryNoteRow(data);
}

/**
 * 견적 문의에 대한 메모 목록 조회
 */
export async function getInquiryNotes(
  inquiryId: string,
  inquiryType: 'external' | 'international',
): Promise<InquiryNote[]> {
  const { data, error } = await supabaseAdmin
    .from('inquiry_notes')
    .select(`
      *,
      admin:user_profiles!admin_id(
        name
      )
    `)
    .eq('inquiry_id', inquiryId)
    .eq('inquiry_type', inquiryType)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getInquiryNotes] select failed', error);
    throw new Error('메모 조회에 실패했습니다.');
  }

  return (data || []).map((row) => ({
    ...mapInquiryNoteRow(row),
    adminName: row.admin?.name || '알 수 없음',
  }));
}

/**
 * 메모 수정
 */
export async function updateInquiryNote(
  id: string,
  note: string,
  adminId: string,
): Promise<InquiryNote> {
  const { data, error } = await supabaseAdmin
    .from('inquiry_notes')
    .update({ note: note.trim() })
    .eq('id', id)
    .eq('admin_id', adminId) // 본인의 메모만 수정 가능
    .select('*')
    .single();

  if (error) {
    console.error('[updateInquiryNote] update failed', error);
    throw new Error('메모 수정에 실패했습니다.');
  }

  return mapInquiryNoteRow(data);
}

/**
 * 메모 삭제
 */
export async function deleteInquiryNote(
  id: string,
  adminId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('inquiry_notes')
    .delete()
    .eq('id', id)
    .eq('admin_id', adminId); // 본인의 메모만 삭제 가능

  if (error) {
    console.error('[deleteInquiryNote] delete failed', error);
    throw new Error('메모 삭제에 실패했습니다.');
  }
}

