import { useState, useCallback, useEffect } from 'react';
import { ScanQueueItem, ScanResult, ScanMode } from '@/types/scanner';

interface UseScanQueueProps {
  onProcess: (barcode: string) => Promise<ScanResult>;
  maxConcurrency?: number;
}

export function useScanQueue({ onProcess, maxConcurrency = 1 }: UseScanQueueProps) {
  const [queue, setQueue] = useState<ScanQueueItem[]>([]);
  const [processingCount, setProcessingCount] = useState(0);

  const addToQueue = useCallback((barcode: string) => {
    const newItem: ScanQueueItem = {
      id: crypto.randomUUID(),
      barcode,
      scannedAt: Date.now(),
      status: 'pending'
    };
    
    setQueue(prev => [...prev, newItem]);
  }, []);

  const processNext = useCallback(async () => {
    if (processingCount >= maxConcurrency) return;

    // Find next pending item
    const pendingItemIndex = queue.findIndex(item => item.status === 'pending');
    if (pendingItemIndex === -1) return;

    const item = queue[pendingItemIndex];
    
    // Mark as processing
    setQueue(prev => prev.map((q, idx) => 
      idx === pendingItemIndex ? { ...q, status: 'processing' } : q
    ));
    setProcessingCount(prev => prev + 1);

    try {
      const result = await onProcess(item.barcode);
      
      setQueue(prev => prev.map(q => 
        q.id === item.id 
          ? { ...q, status: 'completed', result } 
          : q
      ));
    } catch (error) {
      console.error('Scan processing failed', error);
      setQueue(prev => prev.map(q => 
        q.id === item.id 
          ? { ...q, status: 'failed' } 
          : q
      ));
    } finally {
      setProcessingCount(prev => prev - 1);
    }
  }, [queue, processingCount, maxConcurrency, onProcess]);

  useEffect(() => {
    processNext();
  }, [queue, processingCount, processNext]);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return {
    queue,
    addToQueue,
    clearQueue,
    isProcessing: processingCount > 0
  };
}
