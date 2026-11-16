import sharp from 'sharp';
import { DETAIL_MAX_WIDTH } from './html';

const SOURCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export class DetailImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DetailImageError';
  }
}

export async function convertToMobileJpeg(input: Buffer) {
  if (input.length === 0 || input.length > MAX_SOURCE_BYTES) {
    throw new DetailImageError('이미지 크기는 1바이트 이상 10MB 이하여야 합니다.');
  }
  return sharp(input, { failOn: 'error' })
    .rotate()
    .resize({ width: DETAIL_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

export async function downloadSourceImage(url: string, fetchImpl: typeof fetch = fetch) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DetailImageError('이미지 주소가 올바르지 않습니다.');
  }
  if (parsed.protocol !== 'https:') {
    throw new DetailImageError('HTTPS 이미지만 변환할 수 있습니다.');
  }

  const response = await fetchImpl(parsed.toString(), { redirect: 'error' });
  if (!response.ok) {
    throw new DetailImageError(`이미지를 가져오지 못했습니다 (${response.status}).`);
  }
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!SOURCE_TYPES.has(contentType)) {
    throw new DetailImageError('JPEG, PNG, WEBP 이미지만 변환할 수 있습니다.');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_SOURCE_BYTES) {
    throw new DetailImageError('원본 이미지는 10MB를 넘을 수 없습니다.');
  }
  return { bytes, contentType };
}

export function detectImageContentType(bytes: Buffer, declared: string) {
  const normalized = declared.split(';')[0].trim().toLowerCase();
  if (SOURCE_TYPES.has(normalized)) return normalized;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  throw new DetailImageError('JPEG, PNG, WEBP 이미지만 변환할 수 있습니다.');
}

export function extensionForContentType(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/jpeg') return 'jpg';
  throw new DetailImageError('지원하지 않는 이미지 형식입니다.');
}
