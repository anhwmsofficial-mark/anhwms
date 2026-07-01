'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { BellIcon as BellSolidIcon } from '@heroicons/react/24/solid';
import { Notification } from '@/types';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollingDisabledRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (pollingDisabledRef.current) return;

    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (response.status === 401) {
        pollingDisabledRef.current = true;
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      if (!response.ok) return;

      const result = await response.json();
      const payload = result?.data || result;
      setNotifications(Array.isArray(payload?.data) ? payload.data : []);
      setUnreadCount(typeof payload?.unreadCount === 'number' ? payload.unreadCount : 0);
    } catch (error) {
      if (!pollingDisabledRef.current) {
        console.error('Failed to fetch notifications:', error);
      }
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    
    // 30초마다 알림 새로고침
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    const target = notifications.find((n) => n.id === notificationId);
    if (!target || target.isRead) return;

    // Optimistic UI
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      await fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    const previous = notifications;
    const previousUnread = unreadCount;

    setNotifications((prev) =>
      prev.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: new Date() }))
    );
    setUnreadCount(0);

    try {
      setLoading(true);
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
      });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      setNotifications(previous);
      setUnreadCount(previousUnread);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      info: '📝',
      warning: '⚠️',
      success: '✅',
      error: '❌',
      urgent: '🚨',
    };
    return icons[type] || '📝';
  };

  const getTimeAgo = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '-';
    const now = new Date();
    const diff = now.getTime() - parsed.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  };

  return (
    <div className="relative">
      {/* 알림 벨 아이콘 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
      >
        {unreadCount > 0 ? (
          <BellSolidIcon className="h-6 w-6 text-blue-600" />
        ) : (
          <BellIcon className="h-6 w-6" />
        )}
        
        {/* 읽지 않은 알림 뱃지 */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 패널 */}
      {isOpen && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />

          {/* 알림 목록 */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-40 max-h-[600px] flex flex-col">
            {/* 헤더 */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
              <h3 className="text-lg font-bold text-gray-900">알림</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-50"
                >
                  모두 읽음
                </button>
              )}
            </div>

            {/* 알림 목록 */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <BellIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">알림이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => {
                        if (!notification.isRead) {
                          markAsRead(notification.id);
                        }
                        if (notification.linkUrl) {
                          window.location.href = notification.linkUrl;
                        }
                      }}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 아이콘 */}
                        <div className="flex-shrink-0 text-2xl">
                          {getNotificationIcon(notification.type)}
                        </div>

                        {/* 내용 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1"></span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {getTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    window.location.href = '/admin/notifications';
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-semibold w-full text-center"
                >
                  모든 알림 보기
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}




