import supabaseAdmin from '@/lib/supabase-admin';
import { InquiryActionLog } from '@/types';
import { logger } from '@/lib/logger';

function mapActionLogRow(row: any): InquiryActionLog {
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    inquiryType: row.inquiry_type,
    action: row.action,
    actorId: row.actor_id,
    actorName: row.actor_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    details: row.details || {},
    createdAt: new Date(row.created_at),
  };
}

/**
 * 액션 로그 생성
 */
export async function createActionLog(data: {
  inquiryId: string;
  inquiryType: 'external' | 'international';
  action: string;
  actorId?: string;
  actorName?: string;
  oldValue?: string;
  newValue?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<InquiryActionLog> {
  const { data: result, error } = await supabaseAdmin
    .from('inquiry_action_logs')
    .insert({
      inquiry_id: data.inquiryId,
      inquiry_type: data.inquiryType,
      action: data.action,
      actor_id: data.actorId,
      actor_name: data.actorName,
      old_value: data.oldValue,
      new_value: data.newValue,
      details: data.details || {},
      ip_address: data.ipAddress,
      user_agent: data.userAgent,
    })
    .select('*')
    .single();

  if (error) {
    logger.error(error, { scope: 'actionLogs', action: 'createActionLog' });
    throw new Error('액션 로그 생성에 실패했습니다.');
  }

  return mapActionLogRow(result);
}

/**
 * 견적 문의의 액션 로그 조회
 */
export async function getInquiryActionLogs(
  inquiryId: string,
  inquiryType: 'external' | 'international',
): Promise<InquiryActionLog[]> {
  const { data, error } = await supabaseAdmin
    .from('inquiry_action_logs')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .eq('inquiry_type', inquiryType)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error(error, { scope: 'actionLogs', action: 'getInquiryActionLogs' });
    throw new Error('액션 로그 조회에 실패했습니다.');
  }

  return (data || []).map(mapActionLogRow);
}

/**
 * 상태 변경 로그
 */
export async function logStatusChange(data: {
  inquiryId: string;
  inquiryType: 'external' | 'international';
  actorId: string;
  actorName: string;
  oldStatus: string;
  newStatus: string;
}): Promise<void> {
  await createActionLog({
    inquiryId: data.inquiryId,
    inquiryType: data.inquiryType,
    action: 'status_changed',
    actorId: data.actorId,
    actorName: data.actorName,
    oldValue: data.oldStatus,
    newValue: data.newStatus,
    details: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * 담당자 배정 로그
 */
export async function logAssignment(data: {
  inquiryId: string;
  inquiryType: 'external' | 'international';
  actorId: string;
  actorName: string;
  oldAssignee?: string;
  newAssignee: string;
}): Promise<void> {
  await createActionLog({
    inquiryId: data.inquiryId,
    inquiryType: data.inquiryType,
    action: 'assigned',
    actorId: data.actorId,
    actorName: data.actorName,
    oldValue: data.oldAssignee,
    newValue: data.newAssignee,
    details: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * 이메일 발송 로그
 */
export async function logEmailSent(data: {
  inquiryId: string;
  inquiryType: 'external' | 'international';
  actorId: string;
  actorName: string;
  recipient: string;
  subject: string;
}): Promise<void> {
  await createActionLog({
    inquiryId: data.inquiryId,
    inquiryType: data.inquiryType,
    action: 'email_sent',
    actorId: data.actorId,
    actorName: data.actorName,
    newValue: data.recipient,
    details: {
      subject: data.subject,
      timestamp: new Date().toISOString(),
    },
  });
}

