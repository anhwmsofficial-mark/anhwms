import toast from 'react-hot-toast';

const normalizeMessage = (message: string) => {
  const trimmed = (message || '').trim();
  if (!trimmed) return '처리가 완료되었습니다.';
  return trimmed;
};

export const showSuccess = (message: string) => {
  toast.success(normalizeMessage(message), {
    duration: 3000,
    style: {
      background: '#10B981',
      color: '#fff',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#10B981',
    },
  });
};

export const showError = (message: string) => {
  toast.error(normalizeMessage(message), {
    duration: 4000,
    style: {
      background: '#EF4444',
      color: '#fff',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#EF4444',
    },
  });
};

export const showLoading = (message: string) => {
  return toast.loading(normalizeMessage(message));
};

export const dismissToast = (toastId?: string) => {
  toast.dismiss(toastId);
};

