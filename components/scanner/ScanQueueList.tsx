import { ScanQueueItem } from '@/types/scanner';

interface ScanQueueListProps {
  queue: ScanQueueItem[];
}

export default function ScanQueueList({ queue }: ScanQueueListProps) {
  if (queue.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 mt-4">
      <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex justify-between items-center">
        <h3 className="font-semibold text-blue-800 text-sm">Processing Queue</h3>
        <span className="text-xs bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full">
          {queue.length}
        </span>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {queue.map((item) => (
          <div 
            key={item.id} 
            className={`flex items-center justify-between p-3 border-b border-gray-50 last:border-0 ${
              item.status === 'processing' ? 'bg-blue-50/50' : 
              item.status === 'failed' ? 'bg-red-50' : ''
            }`}
          >
            <div className="flex flex-col">
              <span className="font-mono font-medium text-gray-700">{item.barcode}</span>
              <span className="text-xs text-gray-400">
                {new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {item.status === 'processing' && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              )}
              {item.status === 'pending' && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Pending</span>
              )}
              {item.status === 'completed' && (
                <span className="text-green-500 font-bold">✓</span>
              )}
              {item.status === 'failed' && (
                <span className="text-red-500 font-bold">!</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
