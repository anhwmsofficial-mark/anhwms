import supabaseAdmin from '@/lib/supabase-admin';
import { Notification, NotificationType } from '@/types';

function mapNotificationRow(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type as NotificationType,
    inquiryId: row.inquiry_id,
    inquiryType: row.inquiry_type,
    linkUrl: row.link_url,
    isRead: row.is_read || false,
    readAt: row.read_at ? new Date(row.read_at) : null,
    action: row.action,
    createdAt: new Date(row.created_at),
  };
}

/**
 * 알림 생성
 */
export async function createNotification(data: {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  inquiryId?: string;
  inquiryType?: 'external' | 'international';
  linkUrl?: string;
  action?: string;
}): Promise<Notification> {
  const { data: result, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      inquiry_id: data.inquiryId,
      inquiry_type: data.inquiryType,
      link_url: data.linkUrl,
      action: data.action,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[createNotification] error:', error);
    throw new Error('알림 생성에 실패했습니다.');
  }

  return mapNotificationRow(result);
}

/**
 * 사용자 알림 목록 조회
 */
export async function getUserNotifications(
  userId: string,
  options?: {
    unreadOnly?: boolean;
    limit?: number;
  },
): Promise<Notification[]> {
  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq('is_read', false);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getUserNotifications] error:', error);
    throw new Error('알림 조회에 실패했습니다.');
  }

  return (data || []).map(mapNotificationRow);
}

/**
 * 알림 읽음 처리
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('[markNotificationAsRead] error:', error);
    throw new Error('알림 읽음 처리에 실패했습니다.');
  }
}

/**
 * 모든 알림 읽음 처리
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[markAllNotificationsAsRead] error:', error);
    throw new Error('알림 일괄 읽음 처리에 실패했습니다.');
  }
}

/**
 * 읽지 않은 알림 개수
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[getUnreadNotificationCount] error:', error);
    return 0;
  }

  return count || 0;
}

/**
 * 담당자 배정 알림 생성
 */
export async function notifyAssignment(data: {
  assigneeId: string;
  inquiryId: string;
  inquiryType: 'external' | 'international';
  companyName: string;
  assignedBy?: string;
}): Promise<void> {
  await createNotification({
    userId: data.assigneeId,
    title: '새 견적 문의가 배정되었습니다',
    message: `${data.companyName}의 견적 문의가 배정되었습니다.`,
    type: 'info',
    inquiryId: data.inquiryId,
    inquiryType: data.inquiryType,
    linkUrl: `/admin/quote-inquiries?id=${data.inquiryId}`,
    action: 'assigned',
  });
}

/**
 * 상태 변경 알림 생성
 */
export async function notifyStatusChange(data: {
  userId: string;
  inquiryId: string;
  inquiryType: 'external' | 'international';
  companyName: string;
  oldStatus: string;
  newStatus: string;
}): Promise<void> {
  const statusLabels: Record<string, string> = {
    new: '신규',
    checked: '확인됨',
    processing: '상담중',
    quoted: '견적 발송',
    pending: '고객 검토중',
    won: '수주',
    lost: '미수주',
    on_hold: '보류',
  };

  await createNotification({
    userId: data.userId,
    title: '견적 문의 상태가 변경되었습니다',
    message: `${data.companyName}: ${statusLabels[data.oldStatus]} → ${statusLabels[data.newStatus]}`,
    type: 'info',
    inquiryId: data.inquiryId,
    inquiryType: data.inquiryType,
    linkUrl: `/admin/quote-inquiries?id=${data.inquiryId}`,
    action: 'status_changed',
  });
}

