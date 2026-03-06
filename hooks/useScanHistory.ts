import { useState, useCallback } from 'react';
import { RecentScanItem, ScanResult } from '@/types/scanner';

export function useScanHistory(maxItems: number = 20) {
  const [history, setHistory] = useState<RecentScanItem[]>([]);

  const addHistory = useCallback((result: ScanResult) => {
    const newItem: RecentScanItem = {
      ...result,
      id: crypto.randomUUID()
    };
    
    setHistory(prev => [newItem, ...prev].slice(0, maxItems));
  }, [maxItems]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    addHistory,
    clearHistory
  };
}
