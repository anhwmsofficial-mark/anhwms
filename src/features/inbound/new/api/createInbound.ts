export async function createInbound(formData: FormData) {
  const response = await fetch('/api/inbound/plans', {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      error: payload?.error || payload?.message || '입고 예정 생성에 실패했습니다.',
      errorCode: payload?.code || 'INTERNAL_ERROR',
    };
  }

  return {
    success: true,
    data: payload?.data,
  };
}
