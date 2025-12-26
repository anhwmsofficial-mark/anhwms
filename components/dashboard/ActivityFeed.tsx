import { UserCircleIcon } from '@heroicons/react/24/solid';

interface Activity {
  id: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  reason?: string;
  created_at: string;
  actor_role?: string;
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">
        최근 활동 내역이 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">실시간 운영 로그</h3>
        <span className="text-xs text-gray-500">최근 5건</span>
      </div>
      <ul className="divide-y divide-gray-200">
        {activities.map((activity) => (
          <li key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex space-x-3">
              <div className="flex-shrink-0">
                <UserCircleIcon className="h-8 w-8 text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  <span className="uppercase text-blue-600 font-bold mr-1">
                    [{activity.action_type}]
                  </span>
                  {formatResource(activity.resource_type)}
                </p>
                <p className="text-sm text-gray-500 truncate">
                  {activity.reason || '사유 미입력'}
                </p>
              </div>
              <div className="flex-shrink-0 whitespace-nowrap text-xs text-gray-500">
                {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatResource(type: string) {
  const map: Record<string, string> = {
    orders: '주문',
    inventory: '재고',
    inbound: '입고',
    users: '사용자',
    auth: '인증'
  };
  return map[type] || type;
}

