'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  customerPartnerFormSchema,
  type CustomerPartnerFormValues,
  formatBrnDisplay,
  digitsOnlyBrn,
  partnerCategories,
  invoiceAvailableStatuses,
  partnerCategoryLabel,
  invoiceStatusLabel,
  legacyTypeToPartnerCategory,
} from '@/lib/customers/schema';
import { saveCustomerPartnerFormAction } from '@/app/actions/admin/customers';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import Link from 'next/link';

type CustomerRow = Partial<CustomerPartnerFormValues> & {
  id?: string;
  type?: string;
  partner_category?: string | null;
  business_reg_no?: string | null;
  contact_email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
};

function Section({
  title,
  children,
  error,
}: {
  title: string;
  children: React.ReactNode;
  error?: string | null;
}) {
  return (
    <section className="bg-white rounded-lg shadow border border-gray-100 p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-3 mb-4">{title}</h2>
      {error ? (
        <p className="text-sm text-red-600 mb-3" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-gray-700 mb-1">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </label>
  );
}

export default function CustomerPartnerForm({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: CustomerRow | null;
}) {
  const router = useRouter();
  const [topError, setTopError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [uploadingBankbook, setUploadingBankbook] = useState(false);

  const defaults = useMemo<CustomerPartnerFormValues>(() => {
    const brn = digitsOnlyBrn(String(initial?.business_reg_no || ''));
    const cat =
      (initial?.partner_category as CustomerPartnerFormValues['partner_category']) ||
      legacyTypeToPartnerCategory(initial?.type) ||
      'CUSTOMER';
    return {
      name: initial?.name || '',
      partner_category: partnerCategories.includes(cat as any) ? cat : 'CUSTOMER',
      business_reg_no: brn || '',
      ceo_name: initial?.ceo_name || '',
      address_line1: initial?.address_line1 || '',
      address_line2: initial?.address_line2 || undefined,
      business_type: initial?.business_type || '',
      business_item: initial?.business_item || '',
      tax_invoice_email: initial?.tax_invoice_email || initial?.contact_email || '',
      settlement_manager_name: initial?.settlement_manager_name || initial?.contact_name || '',
      settlement_manager_phone: initial?.settlement_manager_phone || initial?.contact_phone || '',
      settlement_basis_memo: initial?.settlement_basis_memo || undefined,
      invoice_available_status:
        (initial?.invoice_available_status as CustomerPartnerFormValues['invoice_available_status']) ||
        'NEEDS_REVIEW',
      corporate_registration_number: initial?.corporate_registration_number || undefined,
      company_phone: initial?.company_phone || undefined,
      fax_number: initial?.fax_number || undefined,
      website_url: initial?.website_url || undefined,
      note: initial?.note || undefined,
      business_license_storage_path: initial?.business_license_storage_path || undefined,
      bankbook_storage_path: initial?.bankbook_storage_path || undefined,
    };
  }, [initial]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerPartnerFormValues>({
    resolver: zodResolver(customerPartnerFormSchema) as Resolver<CustomerPartnerFormValues>,
    defaultValues: defaults,
  });

  const uploadFile = async (file: File, kind: 'business_license' | 'bankbook') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    const res = await fetch('/api/admin/customers/documents', {
      method: 'POST',
      body: fd,
    });
    const body = await res.json();
    if (!res.ok || !body?.ok) {
      throw new Error(body?.message || body?.error || '업로드에 실패했습니다.');
    }
    return String(body.data?.storage_path || '');
  };

  const onSubmit = async (values: CustomerPartnerFormValues) => {
    setTopError(null);
    setSectionErrors({});
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        id: mode === 'edit' && initial?.id ? initial.id : undefined,
      };
      const result = await saveCustomerPartnerFormAction(payload);
      if (!result.ok) {
        setTopError(result.error || '저장에 실패했습니다.');
        setSubmitting(false);
        return;
      }
      router.push(`/admin/customers/${result.data.id}`);
      router.refresh();
    } catch (e) {
      setTopError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const onInvalid = () => {
    const basic = ['name', 'partner_category'].some((k) => (errors as any)[k]);
    const biz = ['business_reg_no', 'ceo_name', 'address_line1', 'business_type', 'business_item'].some(
      (k) => (errors as any)[k],
    );
    const tax = [
      'tax_invoice_email',
      'settlement_manager_name',
      'settlement_manager_phone',
      'invoice_available_status',
    ].some((k) => (errors as any)[k]);
    const next: Record<string, string> = {};
    if (basic) next.basic = '기본 정보 필수 항목을 확인해 주세요.';
    if (biz) next.business = '사업자 정보 필수 항목을 확인해 주세요.';
    if (tax) next.tax = '세금계산서·정산 정보 필수 항목을 확인해 주세요.';
    setSectionErrors(next);
    setTopError('입력값을 확인해 주세요.');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link href="/admin/customers" className="text-sm text-blue-600 hover:underline">
            ← 거래처 목록
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{mode === 'create' ? '신규 거래처 등록' : '거래처 수정'}</h1>
        </div>
      </div>

      <InlineErrorAlert
        error={topError ? { message: topError } : null}
        className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      />

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="pb-24"
        noValidate
      >
        <Section title="1. 기본 정보" error={sectionErrors.basic}>
          <div className="md:col-span-2">
            <FieldLabel required>거래처명</FieldLabel>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              {...register('name')}
            />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <FieldLabel required>거래처 유형</FieldLabel>
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2" {...register('partner_category')}>
              {partnerCategories.map((c) => (
                <option key={c} value={c}>
                  {partnerCategoryLabel[c]}
                </option>
              ))}
            </select>
            {errors.partner_category && (
              <p className="text-sm text-red-600 mt-1">{errors.partner_category.message}</p>
            )}
          </div>
        </Section>

        <Section title="2. 사업자 정보" error={sectionErrors.business}>
          <div>
            <FieldLabel required>사업자등록번호</FieldLabel>
            <Controller
              control={control}
              name="business_reg_no"
              render={({ field }) => (
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono"
                  placeholder="000-00-00000"
                  value={formatBrnDisplay(String(field.value || ''))}
                  onChange={(e) => {
                    const digits = digitsOnlyBrn(e.target.value).slice(0, 10);
                    field.onChange(digits);
                  }}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />
            {errors.business_reg_no && (
              <p className="text-sm text-red-600 mt-1">{errors.business_reg_no.message}</p>
            )}
          </div>
          <div>
            <FieldLabel required>대표자명</FieldLabel>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2" {...register('ceo_name')} />
            {errors.ceo_name && <p className="text-sm text-red-600 mt-1">{errors.ceo_name.message}</p>}
          </div>
          <div className="md:col-span-2">
            <FieldLabel required>사업장 주소</FieldLabel>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2" {...register('address_line1')} />
            {errors.address_line1 && <p className="text-sm text-red-600 mt-1">{errors.address_line1.message}</p>}
          </div>
          <div className="md:col-span-2">
            <FieldLabel>상세 주소</FieldLabel>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2" {...register('address_line2')} />
          </div>
          <div>
            <FieldLabel required>업태</FieldLabel>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2" {...register('business_type')} />
            {errors.business_type && <p className="text-sm text-red-600 mt-1">{errors.business_type.message}</p>}
          </div>
          <div>
            <FieldLabel required>종목</FieldLabel>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2" {...register('business_item')} />
            {errors.business_item && <p className="text-sm text-red-600 mt-1">{errors.business_item.message}</p>}
          </div>
          <div>
            <FieldLabel>법인등록번호</FieldLabel>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              {...register('corporate_registration_number')}
            />
          </div>
          <div>
            <FieldLabel>전화번호</FieldLabel>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2" {...register('company_phone')} />
          </div>
          <div>
            <FieldLabel>팩스번호</FieldLabel>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2" {...register('fax_number')} />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>홈페이지</FieldLabel>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="https://"
              {...register('website_url')}
            />
            {errors.website_url && <p className="text-sm text-red-600 mt-1">{errors.website_url.message}</p>}
          </div>
        </Section>

        <Section title="3. 세금계산서 발행 정보" error={sectionErrors.tax}>
          <div className="md:col-span-2">
            <FieldLabel required>세금계산서 수신 이메일</FieldLabel>
            <input
              type="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              {...register('tax_invoice_email')}
            />
            {errors.tax_invoice_email && (
              <p className="text-sm text-red-600 mt-1">{errors.tax_invoice_email.message}</p>
            )}
          </div>
          <div>
            <FieldLabel required>정산 담당자명</FieldLabel>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2" {...register('settlement_manager_name')} />
            {errors.settlement_manager_name && (
              <p className="text-sm text-red-600 mt-1">{errors.settlement_manager_name.message}</p>
            )}
          </div>
          <div>
            <FieldLabel required>정산 담당자 연락처</FieldLabel>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              {...register('settlement_manager_phone')}
            />
            {errors.settlement_manager_phone && (
              <p className="text-sm text-red-600 mt-1">{errors.settlement_manager_phone.message}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <FieldLabel>정산 기준 메모</FieldLabel>
            <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 min-h-[80px]" {...register('settlement_basis_memo')} />
          </div>
          <div className="md:col-span-2">
            <FieldLabel required>전자세금계산서 발행 가능 여부</FieldLabel>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              {...register('invoice_available_status')}
            >
              {invoiceAvailableStatuses.map((s) => (
                <option key={s} value={s}>
                  {invoiceStatusLabel[s]}
                </option>
              ))}
            </select>
            {errors.invoice_available_status && (
              <p className="text-sm text-red-600 mt-1">{errors.invoice_available_status.message}</p>
            )}
          </div>
        </Section>

        <Section title="4. 첨부 서류">
          <div>
            <FieldLabel>사업자등록증</FieldLabel>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="block w-full text-sm text-gray-600"
              disabled={uploadingLicense}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setSectionErrors((s) => ({ ...s, files: '' }));
                setUploadingLicense(true);
                try {
                  const path = await uploadFile(f, 'business_license');
                  setValue('business_license_storage_path', path, { shouldValidate: true });
                } catch (err) {
                  setSectionErrors((s) => ({
                    ...s,
                    files: err instanceof Error ? err.message : '사업자등록증 업로드에 실패했습니다.',
                  }));
                } finally {
                  setUploadingLicense(false);
                  e.target.value = '';
                }
              }}
            />
            {watch('business_license_storage_path') ? (
              <p className="text-xs text-green-700 mt-1">업로드됨: {watch('business_license_storage_path')}</p>
            ) : null}
          </div>
          <div>
            <FieldLabel>통장사본</FieldLabel>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="block w-full text-sm text-gray-600"
              disabled={uploadingBankbook}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setSectionErrors((s) => ({ ...s, files: '' }));
                setUploadingBankbook(true);
                try {
                  const path = await uploadFile(f, 'bankbook');
                  setValue('bankbook_storage_path', path, { shouldValidate: true });
                } catch (err) {
                  setSectionErrors((s) => ({
                    ...s,
                    files: err instanceof Error ? err.message : '통장사본 업로드에 실패했습니다.',
                  }));
                } finally {
                  setUploadingBankbook(false);
                  e.target.value = '';
                }
              }}
            />
            {watch('bankbook_storage_path') ? (
              <p className="text-xs text-green-700 mt-1">업로드됨: {watch('bankbook_storage_path')}</p>
            ) : null}
          </div>
          {sectionErrors.files ? <p className="text-sm text-red-600 md:col-span-2">{sectionErrors.files}</p> : null}
        </Section>

        <Section title="5. 메모">
          <div className="md:col-span-2">
            <FieldLabel>메모</FieldLabel>
            <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 min-h-[100px]" {...register('note')} />
          </div>
        </Section>

        <div className="flex justify-end gap-3">
          <Link
            href="/admin/customers"
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={submitting || uploadingLicense || uploadingBankbook}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
