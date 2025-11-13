'use client';

import { useState } from 'react';
import {
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: 'error' | 'warning' | 'info';
  category: 'cs' | 'fulfillment' | 'system';
  condition: string;
  threshold: number;
  channels: ('email' | 'sms' | 'webhook')[];
  recipients: string[];
  enabled: boolean;
  triggerCount: number;
  lastTriggered?: Date;
}

const SAMPLE_ALERT_RULES: AlertRule[] = [
  {
    id: 'alert-cs-1',
    name: 'CS 응답시간 초과',
    description: 'CS 평균 응답시간이 3분을 초과할 때 알림',
    type: 'warning',
    category: 'cs',
    condition: 'CS 평균 응답시간',
    threshold: 3,
    channels: ['email', 'sms'],
    recipients: ['cs-manager@anh.com', '010-1234-5678'],
    enabled: true,
    triggerCount: 8,
    lastTriggered: new Date('2025-01-04T14:30:00'),
  },
  {
    id: 'alert-cs-2',
    name: 'CS 만족도 하락',
    description: '고객 만족도가 90% 미만일 때 알림',
    type: 'error',
    category: 'cs',
    condition: '고객 만족도',
    threshold: 90,
    channels: ['email', 'webhook'],
    recipients: ['admin@anh.com'],
    enabled: true,
    triggerCount: 2,
    lastTriggered: new Date('2025-01-03T11:20:00'),
  },
  {
    id: 'alert-cs-3',
    name: '미응답 대화 누적',
    description: '미응답 대화가 10건을 초과할 때 알림',
    type: 'warning',
    category: 'cs',
    condition: '미응답 대화 건수',
    threshold: 10,
    channels: ['sms'],
    recipients: ['010-1234-5678'],
    enabled: true,
    triggerCount: 15,
    lastTriggered: new Date('2025-01-04T16:10:00'),
  },
  {
    id: 'alert-ff-1',
    name: '드롭시핑 오류율 초과',
    description: '드롭시핑 오류율이 5%를 초과할 때 알림',
    type: 'error',
    category: 'fulfillment',
    condition: '드롭시핑 오류율',
    threshold: 5,
    channels: ['email', 'sms'],
    recipients: ['fulfillment@anh.com', '010-9876-5432'],
    enabled: true,
    triggerCount: 12,
    lastTriggered: new Date('2025-01-04T13:15:00'),
  },
  {
    id: 'alert-ff-2',
    name: '운임 급등',
    description: '일일 운임이 전주 대비 10% 이상 증가할 때 알림',
    type: 'warning',
    category: 'fulfillment',
    condition: '일일 운임 증가율',
    threshold: 10,
    channels: ['email'],
    recipients: ['cfo@anh.com', 'admin@anh.com'],
    enabled: true,
    triggerCount: 3,
    lastTriggered: new Date('2025-01-04T11:20:00'),
  },
  {
    id: 'alert-sys-1',
    name: 'API 응답 지연',
    description: 'API 평균 응답시간이 5초를 초과할 때 알림',
    type: 'error',
    category: 'system',
    condition: 'API 응답시간',
    threshold: 5,
    channels: ['email', 'webhook'],
    recipients: ['dev@anh.com'],
    enabled: true,
    triggerCount: 5,
    lastTriggered: new Date('2025-01-04T09:30:00'),
  },
];

interface AlertHistory {
  id: string;
  ruleName: string;
  type: 'error' | 'warning' | 'info';
  category: 'cs' | 'fulfillment' | 'system';
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
}

const SAMPLE_HISTORY: AlertHistory[] = [
  {
    id: 'history-1',
    ruleName: 'CS 응답시간 초과',
    type: 'warning',
    category: 'cs',
    message: 'CS 평균 응답시간이 3.2분으로 임계값(3분)을 초과했습니다.',
    triggeredAt: new Date('2025-01-04T14:30:00'),
    acknowledged: false,
  },
  {
    id: 'history-2',
    ruleName: '미응답 대화 누적',
    type: 'warning',
    category: 'cs',
    message: '미응답 대화가 12건으로 임계값(10건)을 초과했습니다.',
    triggeredAt: new Date('2025-01-04T16:10:00'),
    acknowledged: false,
  },
  {
    id: 'history-3',
    ruleName: '드롭시핑 오류율 초과',
    type: 'error',
    category: 'fulfillment',
    message: '드롭시핑 오류율이 6.2%로 임계값(5%)을 초과했습니다.',
    triggeredAt: new Date('2025-01-04T13:15:00'),
    acknowledged: true,
  },
  {
    id: 'history-4',
    ruleName: '운임 급등',
    type: 'warning',
    category: 'fulfillment',
    message: '오늘 운임이 ₩32,500,000로 전주 대비 12.3% 증가했습니다.',
    triggeredAt: new Date('2025-01-04T11:20:00'),
    acknowledged: true,
  },
];

export default function AlertsPage() {
  const [alertRules, setAlertRules] = useState<AlertRule[]>(SAMPLE_ALERT_RULES);
  const [alertHistory, setAlertHistory] = useState<AlertHistory[]>(SAMPLE_HISTORY);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const toggleRule = (ruleId: string) => {
    setAlertRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule))
    );
  };

  const acknowledgeAlert = (historyId: string) => {
    setAlertHistory((prev) =>
      prev.map((alert) => (alert.id === historyId ? { ...alert, acknowledged: true } : alert))
    );
  };

  // 필터링
  const filteredRules =
    selectedCategory === 'all'
      ? alertRules
      : alertRules.filter((r) => r.category === selectedCategory);

  const filteredHistory =
    selectedCategory === 'all'
      ? alertHistory
      : alertHistory.filter((h) => h.category === selectedCategory);

  // 통계
  const stats = {
    totalRules: alertRules.length,
    activeRules: alertRules.filter((r) => r.enabled).length,
    unacknowledged: alertHistory.filter((h) => !h.acknowledged).length,
    totalTriggered: alertRules.reduce((sum, r) => sum + r.triggerCount, 0),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🔔 알림 설정</h1>
              <p className="text-sm text-gray-600 mt-1">실시간 알림 규칙 관리 및 알림 히스토리</p>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              + 새 알림 규칙
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <BellIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="text-sm text-blue-700 font-medium">전체 규칙</div>
            <div className="text-3xl font-bold text-blue-900 mt-1">{stats.totalRules}</div>
          </div>
          <div className="bg-green-50 border-2 border-green-200 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-sm text-green-700 font-medium">활성화됨</div>
            <div className="text-3xl font-bold text-green-900 mt-1">{stats.activeRules}</div>
          </div>
          <div className="bg-red-50 border-2 border-red-200 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
            </div>
            <div className="text-sm text-red-700 font-medium">미확인 알림</div>
            <div className="text-3xl font-bold text-red-900 mt-1">{stats.unacknowledged}</div>
          </div>
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <ClockIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="text-sm text-purple-700 font-medium">총 발생 횟수</div>
            <div className="text-3xl font-bold text-purple-900 mt-1">{stats.totalTriggered}</div>
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg transition ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setSelectedCategory('cs')}
              className={`px-4 py-2 rounded-lg transition ${
                selectedCategory === 'cs'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              CS 시스템
            </button>
            <button
              onClick={() => setSelectedCategory('fulfillment')}
              className={`px-4 py-2 rounded-lg transition ${
                selectedCategory === 'fulfillment'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Global Fulfillment
            </button>
            <button
              onClick={() => setSelectedCategory('system')}
              className={`px-4 py-2 rounded-lg transition ${
                selectedCategory === 'system'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              시스템
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* 알림 규칙 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BellIcon className="h-5 w-5" />
                알림 규칙
              </h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-[700px] overflow-y-auto">
              {filteredRules.map((rule) => (
                <div key={rule.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                        <CategoryBadge category={rule.category} />
                        <AlertTypeBadge type={rule.type} />
                        {rule.enabled ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold">
                            ON
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                            OFF
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{rule.description}</p>
                    </div>
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rule.enabled ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-gray-600 text-xs">조건</div>
                      <div className="font-semibold">{rule.condition}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-gray-600 text-xs">임계값</div>
                      <div className="font-semibold">
                        {rule.threshold}
                        {rule.condition.includes('율') || rule.condition.includes('만족도')
                          ? '%'
                          : rule.condition.includes('시간')
                          ? '분'
                          : '건'}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-gray-600 mb-1">알림 채널</div>
                    <div className="flex gap-2">
                      {rule.channels.map((channel) => (
                        <ChannelBadge key={channel} channel={channel} />
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-gray-600">
                    <span>
                      발생 횟수: <strong>{rule.triggerCount}회</strong>
                    </span>
                    {rule.lastTriggered && (
                      <span className="ml-3">
                        마지막: {rule.lastTriggered.toLocaleString('ko-KR')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 알림 히스토리 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ClockIcon className="h-5 w-5" />
                알림 히스토리
              </h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-[700px] overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <BellIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p>알림 히스토리가 없습니다</p>
                </div>
              ) : (
                filteredHistory.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 ${
                      alert.acknowledged ? 'bg-gray-50' : 'bg-yellow-50'
                    } hover:bg-gray-100 transition`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CategoryBadge category={alert.category} />
                        <AlertTypeBadge type={alert.type} />
                        <span className="font-semibold text-gray-900">{alert.ruleName}</span>
                      </div>
                      {!alert.acknowledged && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          확인
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-gray-700 mb-2">{alert.message}</p>

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{alert.triggeredAt.toLocaleString('ko-KR')}</span>
                      {alert.acknowledged && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircleIcon className="h-4 w-4" />
                          확인됨
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 알림 채널 설정 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">알림 채널 설정</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <EnvelopeIcon className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">이메일</h3>
                    <p className="text-xs text-gray-600">Email Notification</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="admin@anh.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                    이메일 추가
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <DevicePhoneMobileIcon className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">SMS</h3>
                    <p className="text-xs text-gray-600">문자 메시지</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <input
                    type="tel"
                    placeholder="010-1234-5678"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <button className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                    번호 추가
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <ChatBubbleLeftRightIcon className="h-8 w-8 text-purple-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Webhook</h3>
                    <p className="text-xs text-gray-600">API Webhook</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <button className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm">
                    Webhook 추가
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: 'cs' | 'fulfillment' | 'system' }) {
  const styles = {
    cs: 'bg-blue-100 text-blue-700',
    fulfillment: 'bg-green-100 text-green-700',
    system: 'bg-gray-100 text-gray-700',
  };

  const labels = {
    cs: 'CS',
    fulfillment: '물류',
    system: '시스템',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[category]}`}>
      {labels[category]}
    </span>
  );
}

function AlertTypeBadge({ type }: { type: 'error' | 'warning' | 'info' }) {
  const styles = {
    error: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
  };

  const labels = {
    error: '🔴 오류',
    warning: '🟡 경고',
    info: '🔵 정보',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: 'email' | 'sms' | 'webhook' }) {
  const styles = {
    email: 'bg-blue-100 text-blue-700',
    sms: 'bg-green-100 text-green-700',
    webhook: 'bg-purple-100 text-purple-700',
  };

  const icons = {
    email: '📧',
    sms: '💬',
    webhook: '🔗',
  };

  const labels = {
    email: 'Email',
    sms: 'SMS',
    webhook: 'Webhook',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[channel]}`}>
      {icons[channel]} {labels[channel]}
    </span>
  );
}

