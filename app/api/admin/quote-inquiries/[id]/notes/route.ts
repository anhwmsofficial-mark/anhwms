import { NextRequest } from 'next/server';
import { createInquiryNote, getInquiryNotes } from '@/lib/api/inquiryNotes';
import { supabase } from '@/lib/supabase';
import { fail, ok } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', 'Unauthorized', { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const inquiryType = searchParams.get('type') as 'external' | 'international';

    if (!inquiryType || !['external', 'international'].includes(inquiryType)) {
      return fail('BAD_REQUEST', 'Invalid inquiry type', { status: 400 });
    }

    const notes = await getInquiryNotes(id, inquiryType);

    return ok(notes, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/quote-inquiries/[id]/notes] error:', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch notes', { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', 'Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { note, inquiryType } = body;

    if (!note || !inquiryType) {
      return fail('BAD_REQUEST', 'Missing required fields', { status: 400 });
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
    return fail('INTERNAL_ERROR', 'Failed to create note', { status: 500 });
  }
}

