import { useEffect, useRef, useState, useCallback } from 'react';

interface UseHidScannerProps {
  onScan: (barcode: string) => void;
  minScanLength?: number;
  timeThreshold?: number; // Time between keystrokes to be considered a scan
}

/**
 * Hook to handle HID barcode scanner input (keyboard emulation).
 * Detects rapid keystrokes ending with Enter.
 */
export function useHidScanner({ 
  onScan, 
  minScanLength = 3,
  timeThreshold = 50 
}: UseHidScannerProps) {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input field, unless it's a specific "scan input" that might be handled differently
    // However, the requirement is to prevent interception when focused on inputs.
    // If an input is focused, the browser will fill the input. We should NOT intercept and clear it globally.
    const target = e.target as HTMLElement;
    const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    if (isInputFocused) {
      return; 
    }

    const currentTime = Date.now();
    const char = e.key;

    // Check if it's a control key or non-character key (except Enter)
    if (char.length > 1 && char !== 'Enter') {
      return; 
    }

    if (char === 'Enter') {
      // If buffer has content, treat as scan
      if (buffer.current.length >= minScanLength) {
        e.preventDefault(); // Prevent default Enter behavior (like submitting a form if any)
        onScan(buffer.current);
      }
      buffer.current = ''; // Clear buffer regardless
      return;
    }

    // Logic to distinguish manual typing vs scanner
    // Scanners are fast (<50ms usually). Humans are slow.
    // If the time since last key is large, reset buffer (it's a new sequence or manual typing start)
    if (currentTime - lastKeyTime.current > timeThreshold) {
      buffer.current = '';
    }

    buffer.current += char;
    lastKeyTime.current = currentTime;
  }, [onScan, minScanLength, timeThreshold]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
