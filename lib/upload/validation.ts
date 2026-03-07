export type UploadPolicy = {
  label: string;
  maxBytes: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
};

export const UPLOAD_POLICIES = {
  inventorySpreadsheet: {
    label: '재고 엑셀 파일',
    maxBytes: 10 * 1024 * 1024,
    allowedExtensions: ['xlsx', 'xls', 'csv'],
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ],
  },
  ordersSpreadsheet: {
    label: '주문 엑셀 파일',
    maxBytes: 5 * 1024 * 1024,
    allowedExtensions: ['xlsx', 'xls'],
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
  },
  receiptDocument: {
    label: '문서 파일',
    maxBytes: 10 * 1024 * 1024,
    allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
  },
} satisfies Record<string, UploadPolicy>;

const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream']);

function getExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

export function validateUploadInput(input: {
  fileName: string;
  mimeType?: string | null;
  size: number;
  policy: UploadPolicy;
}) {
  const fileName = String(input.fileName || '').trim();
  const mimeType = String(input.mimeType || '').trim().toLowerCase();
  const size = Number(input.size || 0);
  const extension = getExtension(fileName);
  const { policy } = input;

  if (!fileName) {
    throw new Error('파일명이 필요합니다.');
  }
  if (!extension || !policy.allowedExtensions.includes(extension)) {
    throw new Error(
      `${policy.label} 형식이 올바르지 않습니다. 허용 확장자: ${policy.allowedExtensions.join(', ')}`,
    );
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('비어 있는 파일은 업로드할 수 없습니다.');
  }
  if (size > policy.maxBytes) {
    throw new Error(
      `${policy.label} 최대 크기는 ${Math.floor(policy.maxBytes / (1024 * 1024))}MB 입니다.`,
    );
  }
  if (!GENERIC_MIME_TYPES.has(mimeType) && !policy.allowedMimeTypes.includes(mimeType)) {
    throw new Error(
      `${policy.label} MIME 형식이 허용되지 않습니다. 허용 MIME: ${policy.allowedMimeTypes.join(', ')}`,
    );
  }

  return {
    extension,
    mimeType,
    size,
  };
}
