import { NextRequest } from 'next/server';
import { createInquiryNote, getInquiryNotes } from '@/lib/api/inquiryNotes';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { fail, ok } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('manage:orders', request);
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', '로그인이 필요합니다.', { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const inquiryType = searchParams.get('type') as 'external' | 'international';

    if (!inquiryType || !['external', 'international'].includes(inquiryType)) {
      return fail('BAD_REQUEST', '유효하지 않은 문의 유형입니다.', { status: 400 });
    }

    const notes = await getInquiryNotes(id, inquiryType);

    return ok(notes, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/quote-inquiries/[id]/notes] error:', error);
    return fail('INTERNAL_ERROR', '메모를 불러오지 못했습니다.', { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('manage:orders', request);
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', '로그인이 필요합니다.', { status: 401 });
    }

    const body = await request.json();
    const { note, inquiryType } = body;

    if (!note || !inquiryType) {
      return fail('BAD_REQUEST', '필수 항목이 누락되었습니다.', { status: 400 });
    }

    const newNote = await createInquiryNote(
      {
        inquiryId: id,
        inquiryType,
        note,
      },
      user.id,
    );

    return ok(newNote, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/quote-inquiries/[id]/notes] error:', error);
    return fail('INTERNAL_ERROR', '메모 생성에 실패했습니다.', { status: 500 });
  }
}

