'use client';

import { useState } from 'react';
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  QrCodeIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface TaskSummary {
  total: number;
  inProgress: number;
  completed: number;
  pending: number;
}

const SAMPLE_TASKS: TaskSummary = {
  total: 12,
  inProgress: 5,
  completed: 6,
  pending: 1,
};

export default function OperationsDashboardPage() {
  const [tasks] = useState<TaskSummary>(SAMPLE_TASKS);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">👷 운영팀 대시보드</h1>
              <p className="text-sm text-gray-600 mt-1">
                현장 작업 실행 및 기록
              </p>
            </div>
            <div className="text-sm text-gray-600">
              {new Date().toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 오늘의 작업 현황 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 오늘의 작업 현황</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border-2 border-gray-200 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <ClipboardDocumentCheckIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-sm text-gray-600">전체 작업</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">{tasks.total}</div>
            </div>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <ClockIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-sm text-gray-600">진행 중</div>
              <div className="text-3xl font-bold text-blue-600 mt-1">{tasks.inProgress}</div>
            </div>
            <div className="bg-green-50 border-2 border-green-200 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-sm text-gray-600">완료</div>
              <div className="text-3xl font-bold text-green-600 mt-1">{tasks.completed}</div>
            </div>
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="text-sm text-gray-600">대기</div>
              <div className="text-3xl font-bold text-yellow-600 mt-1">{tasks.pending}</div>
            </div>
          </div>
        </div>

        {/* 빠른 액세스 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ 빠른 액세스</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAccessCard
              title="Ops 보드"
              description="오늘 작업 전체 보기"
              icon={ClipboardDocumentCheckIcon}
              href="/ops-board"
              color="blue"
            />
            <QuickAccessCard
              title="My Tasks"
              description="내가 할 작업"
              icon={CheckCircleIcon}
              href="/my-tasks"
              color="green"
            />
            <QuickAccessCard
              title="포장 관리"
              description="포장 작업 처리"
              icon={CubeIcon}
              href="/operations/packing"
              color="purple"
            />
            <QuickAccessCard
              title="스캔 처리"
              description="QR/바코드 스캔"
              icon={QrCodeIcon}
              href="/scanner-test"
              color="orange"
            />
          </div>
        </div>

        {/* 최근 활동 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />
              최근 활동
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            <ActivityItem
              type="completed"
              message="노트북 입고 작업 완료 (ASN-2025-001)"
              worker="김철수"
              time="10분 전"
            />
            <ActivityItem
              type="started"
              message="마우스 출고 작업 시작 (ORD-2025-002)"
              worker="이영희"
              time="25분 전"
            />
            <ActivityItem
              type="memo"
              message="키보드 포장 상태 양호 - 메모 작성"
              worker="박민수"
              time="1시간 전"
            />
          </div>
        </div>

        {/* 공지사항 */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
          <div className="flex">
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h3 className="text-sm font-semibold text-blue-900">📢 공지사항</h3>
              <p className="text-sm text-blue-700 mt-1">
                • 오후 3시 안전 교육이 있습니다.<br />
                • 새로운 포장재가 C구역에 비치되었습니다.<br />
                • 작업 중 이슈 발견 시 즉시 메모를 남겨주세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAccessCard({
  title,
  description,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  description: string;
  icon: any;
  href: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200',
    green: 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200',
    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200',
  };

  return (
    <Link
      href={href}
      className={`${colors[color]} border-2 rounded-lg p-6 transition flex flex-col items-center text-center group`}
    >
      <Icon className="h-12 w-12 mb-3 group-hover:scale-110 transition-transform" />
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-xs opacity-75">{description}</p>
    </Link>
  );
}

function ActivityItem({
  type,
  message,
  worker,
  time,
}: {
  type: 'completed' | 'started' | 'memo';
  message: string;
  worker: string;
  time: string;
}) {
  const icons = {
    completed: '✅',
    started: '🔄',
    memo: '📝',
  };

  return (
    <div className="p-4 hover:bg-gray-50 flex items-start gap-3">
      <div className="text-2xl">{icons[type]}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{message}</p>
        <p className="text-xs text-gray-500 mt-1">
          {worker} • {time}
        </p>
      </div>
    </div>
  );
}

