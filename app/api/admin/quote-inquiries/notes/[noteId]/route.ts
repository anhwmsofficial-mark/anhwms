import { NextRequest, NextResponse } from 'next/server';
import { updateInquiryNote, deleteInquiryNote } from '@/lib/api/inquiryNotes';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    const { noteId } = await params;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { note } = body;

    if (!note) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 },
      );
    }

    const updatedNote = await updateInquiryNote(noteId, note, user.id);

    return NextResponse.json({ data: updatedNote }, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/admin/quote-inquiries/notes/[noteId]] error:', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    const { noteId } = await params;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteInquiryNote(noteId, user.id);

    return NextResponse.json({ message: 'Note deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('[DELETE /api/admin/quote-inquiries/notes/[noteId]] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 },
    );
  }
}

