'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CustomerPartnerForm from '@/components/admin/customers/CustomerPartnerForm';
import { getCustomerByIdAction } from '@/app/actions/admin/customers';
import InlineErrorAlert from '@/components/ui/inline-error-alert';

export default function EditCustomerPage() {
  const params = useParams();
  const id = String((params as { id?: string })?.id || '');
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getCustomerByIdAction(id);
    if (!res.ok) {
      setRow(null);
      setError(res.error || '불러오지 못했습니다.');
    } else {
      setRow(res.data as Record<string, unknown>);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 max-w-lg mx-auto">
        <InlineErrorAlert error={{ message: error || '거래처를 찾을 수 없습니다.' }} className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerPartnerForm mode="edit" initial={row as any} />
    </div>
  );
}
