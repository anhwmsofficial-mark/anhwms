/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import { CustomerActivity, CreateCustomerActivityInput } from '@/types';
import { requirePermission } from '@/utils/rbac';

// 거래처 활동 이력 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('manage:orders', req);
    const { id: customerId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    const { data, error } = await supabaseAdmin
      .from('customer_activity')
      .select(`
        *,
        customer_contact:related_contact_id (
          id,
          name,
          role
        ),
        user_profiles:performed_by_user_id (
          id,
          username,
          email
        )
      `)
      .eq('customer_master_id', customerId)
      .order('activity_date', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const activities: CustomerActivity[] = (data || []).map((row: any) => ({
      id: row.id,
      customerMasterId: row.customer_master_id,
      activityType: row.activity_type,
      subject: row.subject,
      description: row.description,
      relatedContactId: row.related_contact_id,
      performedByUserId: row.performed_by_user_id,
      priority: row.priority,
      requiresFollowup: row.requires_followup,
      followupDueDate: row.followup_due_date ? new Date(row.followup_due_date) : null,
      followupCompleted: row.followup_completed,
      followupCompletedAt: row.followup_completed_at ? new Date(row.followup_completed_at) : null,
      attachmentUrls: row.attachment_urls,
      tags: row.tags,
      activityDate: new Date(row.activity_date),
      durationMinutes: row.duration_minutes,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      relatedContact: row.customer_contact ? {
        id: row.customer_contact.id,
        name: row.customer_contact.name,
        role: row.customer_contact.role,
      } : undefined,
      performedByUser: row.user_profiles ? {
        id: row.user_profiles.id,
        username: row.user_profiles.username,
        email: row.user_profiles.email,
      } : undefined,
    }));

    return NextResponse.json({ success: true, data: activities });
  } catch (error: any) {
    console.error('Error fetching customer activities:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 거래처 활동 이력 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('manage:orders', req);
    const { id: customerId } = await params;
    const body: CreateCustomerActivityInput = await req.json();

    const { data, error } = await supabaseAdmin
      .from('customer_activity')
      .insert({
        customer_master_id: customerId,
        activity_type: body.activityType,
        subject: body.subject,
        description: body.description,
        related_contact_id: body.relatedContactId,
        performed_by_user_id: body.performedByUserId,
        priority: body.priority || 'NORMAL',
        requires_followup: body.requiresFollowup || false,
        followup_due_date: body.followupDueDate,
        tags: body.tags,
        activity_date: body.activityDate || new Date(),
        duration_minutes: body.durationMinutes,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error creating customer activity:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

