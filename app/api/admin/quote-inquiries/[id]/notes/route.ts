import { NextRequest, NextResponse } from 'next/server';
import { createInquiryNote, getInquiryNotes } from '@/lib/api/inquiryNotes';
import { createClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const inquiryType = searchParams.get('type') as 'external' | 'international';

    if (!inquiryType || !['external', 'international'].includes(inquiryType)) {
      return NextResponse.json(
        { error: 'Invalid inquiry type' },
        { status: 400 },
      );
    }

    const notes = await getInquiryNotes(params.id, inquiryType);

    return NextResponse.json({ data: notes }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/quote-inquiries/[id]/notes] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { note, inquiryType } = body;

    if (!note || !inquiryType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const newNote = await createInquiryNote(
      {
        inquiryId: params.id,
        inquiryType,
        note,
      },
      user.id,
    );

    return NextResponse.json({ data: newNote }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/quote-inquiries/[id]/notes] error:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 },
    );
  }
}

