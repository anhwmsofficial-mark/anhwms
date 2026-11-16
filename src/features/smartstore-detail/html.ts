export const DETAIL_MAX_WIDTH = 860;
export const DETAIL_IMAGE_STYLE = 'display:block;width:100%;max-width:860px;height:auto;border:0;margin:0 auto;';

export class UnsafeDetailContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeDetailContentError';
  }
}

const HTTPS_JPEG = /^https:\/\/[^\s"'<>]+$/i;

export function assertHttpsJpegUrl(value: string) {
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new UnsafeDetailContentError('이미지 주소가 올바르지 않습니다.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new UnsafeDetailContentError('HTTPS 이미지만 허용됩니다.');
  }
  if (!HTTPS_JPEG.test(trimmed) || !/\.jpe?g$/i.test(url.pathname)) {
    throw new UnsafeDetailContentError('JPG 이미지만 허용됩니다.');
  }
  return url.toString();
}

function escapeAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function assertSafeDetailHtml(html: string) {
  const lowered = html.toLowerCase();
  if (/<\s*script\b|<\s*iframe\b|<\s*object\b|<\s*embed\b|javascript:|on\w+\s*=/.test(lowered)) {
    throw new UnsafeDetailContentError('스크립트와 실행 가능한 콘텐츠는 허용되지 않습니다.');
  }
  if (/http:\/\//i.test(html)) {
    throw new UnsafeDetailContentError('혼합 콘텐츠(HTTP)는 허용되지 않습니다.');
  }
  const sources = [...html.matchAll(/\ssrc="([^"]+)"/g)].map((match) => match[1]);
  if (sources.length === 0) {
    throw new UnsafeDetailContentError('상세 HTML에는 이미지가 있어야 합니다.');
  }
  sources.forEach((source) => assertHttpsJpegUrl(source.replaceAll('&amp;', '&')));
  if (!/width:\s*100%/.test(html) || !/max-width:\s*860px/.test(html) || !/height:\s*auto/.test(html)) {
    throw new UnsafeDetailContentError('모바일 이미지 규격 스타일이 없습니다.');
  }
  return html;
}

export function buildMobileDetailHtml(imageUrls: string[]) {
  if (imageUrls.length === 0) {
    throw new UnsafeDetailContentError('변환할 상세 이미지가 없습니다.');
  }
  const safeUrls = imageUrls.map(assertHttpsJpegUrl);
  const images = safeUrls
    .map((src) => `<img src="${escapeAttribute(src)}" alt="" style="${DETAIL_IMAGE_STYLE}" />`)
    .join('');
  const html = `<div style="max-width:${DETAIL_MAX_WIDTH}px;margin:0 auto;font-size:0;line-height:0;">${images}</div>`;
  return assertSafeDetailHtml(html);
}
