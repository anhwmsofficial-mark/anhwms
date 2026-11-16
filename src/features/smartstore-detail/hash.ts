import { createHash } from 'node:crypto';

export function detailContentHash(channelProductNo: string, html: string) {
  return createHash('sha256').update(channelProductNo).update('\n').update(html).digest('hex');
}

export function jobIdempotencyKey(parts: Array<{ channelProductNo: string; contentHash: string }>) {
  const canonical = [...parts]
    .sort((left, right) => left.channelProductNo.localeCompare(right.channelProductNo))
    .map((part) => `${part.channelProductNo}:${part.contentHash}`)
    .join('|');
  return createHash('sha256').update(canonical).digest('hex');
}
