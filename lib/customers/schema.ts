import { z } from 'zod';

export const partnerCategories = ['CUSTOMER', 'SUPPLIER', 'CARRIER', 'OTHER'] as const;
export type PartnerCategory = (typeof partnerCategories)[number];

export const domesticOverseasTypes = ['DOMESTIC', 'OVERSEAS'] as const;
export type DomesticOverseasType = (typeof domesticOverseasTypes)[number];

export const invoiceAvailableStatuses = ['AVAILABLE', 'UNAVAILABLE', 'NEEDS_REVIEW'] as const;
export type InvoiceAvailableStatus = (typeof invoiceAvailableStatuses)[number];

export const digitsOnlyBrn = (value: string) => String(value || '').replace(/\D/g, '');

export function formatBrnDisplay(value: string) {
  const d = digitsOnlyBrn(value).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5, 10)}`;
}

const optionalText = z
  .string()
  .optional()
  .transform((v) => (v == null || String(v).trim() === '' ? undefined : String(v).trim()));

const optionalUrl = z
  .string()
  .optional()
  .transform((v) => {
    const t = String(v || '').trim();
    if (!t) return undefined;
    return t;
  })
  .refine((v) => v === undefined || /^https?:\/\//i.test(v), '홈페이지는 http(s):// 로 시작해야 합니다.');

const optionalEmail = z
  .string()
  .optional()
  .transform((v) => {
    const t = String(v || '').trim();
    return t || undefined;
  })
  .refine((v) => v === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), '이메일 형식이 올바르지 않습니다.');

export const customerPartnerFormSchema = z.object({
  name: z.string().min(1, '거래처명을 입력하세요.'),
  partner_category: z.enum(partnerCategories, { message: '거래처 유형을 선택하세요.' }),
  business_reg_no: z
    .string()
    .transform(digitsOnlyBrn)
    .refine((v) => v.length === 10, '사업자등록번호는 10자리 숫자여야 합니다.'),
  ceo_name: z.string().min(1, '대표자명을 입력하세요.'),
  address_line1: optionalText,
  address_line2: optionalText,
  business_type: optionalText,
  business_item: optionalText,
  tax_invoice_email: optionalEmail,
  settlement_manager_name: optionalText,
  settlement_manager_phone: optionalText,
  settlement_basis_memo: optionalText,
  invoice_available_status: z.enum(invoiceAvailableStatuses, {
    message: '전자세금계산서 발행 가능 여부를 선택하세요.',
  }),
  domestic_overseas_type: z.enum(domesticOverseasTypes).default('DOMESTIC'),
  service_type: optionalText,
  has_business_license_document: z.boolean().optional().default(false),
  has_bankbook_document: z.boolean().optional().default(false),
  has_contract_document: z.boolean().optional().default(false),
  contract_start_date: optionalText,
  contract_end_date: optionalText,
  contact_status: optionalText,
  corporate_registration_number: optionalText,
  company_phone: optionalText,
  fax_number: optionalText,
  website_url: optionalUrl,
  note: optionalText,
  business_license_storage_path: optionalText,
  bankbook_storage_path: optionalText,
  contract_storage_path: optionalText,
});

export type CustomerPartnerFormValues = z.infer<typeof customerPartnerFormSchema>;

export function mapPartnerCategoryToLegacyType(category: PartnerCategory): string {
  switch (category) {
    case 'CUSTOMER':
      return 'DIRECT_BRAND';
    case 'SUPPLIER':
      return 'SUPPLIER_MATERIAL';
    case 'CARRIER':
      return 'PARTNER_CARRIER';
    case 'OTHER':
    default:
      return 'LOGISTICS_PARTNER';
  }
}

export const partnerCategoryLabel: Record<PartnerCategory, string> = {
  CUSTOMER: '고객사',
  SUPPLIER: '공급사',
  CARRIER: '운송사',
  OTHER: '기타',
};

export const domesticOverseasTypeLabel: Record<DomesticOverseasType, string> = {
  DOMESTIC: '국내',
  OVERSEAS: '해외',
};

export const invoiceStatusLabel: Record<InvoiceAvailableStatus, string> = {
  AVAILABLE: '가능',
  UNAVAILABLE: '불가',
  NEEDS_REVIEW: '확인 필요',
};

export function legacyTypeToPartnerCategory(type: string | null | undefined): PartnerCategory {
  const t = String(type || '').trim();
  if (
    [
      'DIRECT_BRAND',
      'AGENCY',
      'MULTI_BRAND',
      'CLIENT_BRAND',
      'CLIENT_AGENCY',
      'CLIENT_MULTI_BRAND',
      'END_CUSTOMER',
      'PROSPECT',
    ].includes(t)
  ) {
    return 'CUSTOMER';
  }
  if (t.startsWith('SUPPLIER')) return 'SUPPLIER';
  if (t === 'PARTNER_CARRIER' || t === 'FORWARDER') return 'CARRIER';
  return 'OTHER';
}
