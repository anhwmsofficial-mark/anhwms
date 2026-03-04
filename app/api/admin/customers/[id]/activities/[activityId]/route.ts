import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';
import { getErrorMessage } from '@/lib/errorHandler';
import type { Database } from '@/types/supabase';

type ActivityUpdateBody = {
  subject?: string;
  description?: string | null;
  priority?: string;
  requiresFollowup?: boolean;
  followupDueDate?: string | null;
  followupCompleted?: boolean;
};

// 활동 이력 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    await requirePermission('manage:orders', req);
    const { activityId } = await params;
    const body = await req.json() as ActivityUpdateBody;

    const updateData: Database['public']['Tables']['customer_activity']['Update'] = {};
    if (body.subject !== undefined) updateData.subject = body.subject;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.requiresFollowup !== undefined) updateData.requires_followup = body.requiresFollowup;
    if (body.followupDueDate !== undefined) updateData.followup_due_date = body.followupDueDate;
    if (body.followupCompleted !== undefined) {
      updateData.followup_completed = body.followupCompleted;
      if (body.followupCompleted) {
        updateData.followup_completed_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabaseAdmin
      .from('customer_activity')
      .update(updateData)
      .eq('id', activityId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error updating customer activity:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// 활동 이력 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    await requirePermission('manage:orders', req);
    const { activityId } = await params;

    const { data, error } = await supabaseAdmin
      .from('customer_activity')
      .delete()
      .eq('id', activityId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error deleting customer activity:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

