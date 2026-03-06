/**
 * Handles auditory and haptic feedback for scanning events.
 */

type FeedbackType = 'success' | 'error' | 'warning' | 'info';

export const playScanSound = (type: FeedbackType) => {
  if (typeof window === 'undefined') return;

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;

    if (type === 'success') {
      // High pitch, short beep
      oscillator.frequency.setValueAtTime(880, now); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1760, now + 0.1); // A6
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
    } else if (type === 'error') {
      // Low pitch, longer buzz
      oscillator.frequency.setValueAtTime(150, now);
      oscillator.type = 'sawtooth';
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } else if (type === 'warning') {
      // Two quick low beeps
      oscillator.frequency.setValueAtTime(440, now);
      gainNode.gain.setValueAtTime(0.1, now);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
      
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.setValueAtTime(440, now + 0.15);
      gain2.gain.setValueAtTime(0.1, now + 0.15);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.25);
    }
  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
};

export const triggerHaptic = (type: FeedbackType) => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  try {
    if (type === 'success') {
      navigator.vibrate(50);
    } else if (type === 'error') {
      navigator.vibrate([100, 50, 100]);
    } else if (type === 'warning') {
      navigator.vibrate([50, 50, 50]);
    }
  } catch (e) {
    console.warn('Haptic feedback failed:', e);
  }
};

export const scanFeedback = {
  success: () => {
    playScanSound('success');
    triggerHaptic('success');
  },
  error: () => {
    playScanSound('error');
    triggerHaptic('error');
  },
  warning: () => {
    playScanSound('warning');
    triggerHaptic('warning');
  }
};
