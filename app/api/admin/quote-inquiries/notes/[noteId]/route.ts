import { NextRequest } from 'next/server';
import { updateInquiryNote, deleteInquiryNote } from '@/lib/api/inquiryNotes';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { fail, ok } from '@/lib/api/response';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    await requirePermission('manage:orders', request);
    const { noteId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', 'Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { note } = body;

    if (!note) {
      return fail('BAD_REQUEST', 'Note content is required', { status: 400 });
    }

    const updatedNote = await updateInquiryNote(noteId, note, user.id);

    return ok(updatedNote, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/admin/quote-inquiries/notes/[noteId]] error:', error);
    return fail('INTERNAL_ERROR', 'Failed to update note', { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    await requirePermission('manage:orders', request);
    const { noteId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', 'Unauthorized', { status: 401 });
    }

    await deleteInquiryNote(noteId, user.id);

    return ok({ message: 'Note deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('[DELETE /api/admin/quote-inquiries/notes/[noteId]] error:', error);
    return fail('INTERNAL_ERROR', 'Failed to delete note', { status: 500 });
  }
}

