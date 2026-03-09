import { RecentScanItem } from '@/types/scanner';

interface RecentScanListProps {
  history: RecentScanItem[];
}

export default function RecentScanList({ history }: RecentScanListProps) {
  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700 text-sm">최근 스캔 내역</h3>
        <span className="text-xs text-gray-400">{history.length}건</span>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {history.map((item) => (
          <div 
            key={item.id}
            className={`flex items-center justify-between p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${
              item.status === 'error' ? 'bg-red-50' : 
              item.status === 'warning' ? 'bg-yellow-50' : ''
            }`}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className={`font-mono font-bold ${
                  item.status === 'success' ? 'text-gray-800' : 
                  item.status === 'error' ? 'text-red-700' : 'text-yellow-700'
                }`}>
                  {item.barcode}
                </span>
                {item.type === 'location' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 font-bold uppercase">
                    LOC
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <span className={`text-sm ${
                item.status === 'error' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {item.message || item.data?.name || '알 수 없는 항목'}
              </span>
            </div>
            
            <div className="flex flex-col items-end">
               {item.status === 'success' && (
                 <span className="text-green-500 text-lg">✓</span>
               )}
               {item.status === 'error' && (
                 <span className="text-red-500 text-lg">✕</span>
               )}
               {item.mode === 'count' && item.data?.qty && (
                 <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                   x{item.data.qty}
                 </span>
               )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
