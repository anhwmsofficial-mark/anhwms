import crypto from 'crypto';

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE62_MAX_UNBIASED_BYTE = 256 - (256 % BASE62.length);

export const DEFAULT_SHARE_SLUG_LENGTH = 22;

export function generateSlug(length = DEFAULT_SHARE_SLUG_LENGTH) {
  let slug = '';

  while (slug.length < length) {
    const bytes = crypto.randomBytes(Math.max(length * 2, 32));
    for (const byte of bytes) {
      if (byte >= BASE62_MAX_UNBIASED_BYTE) continue;
      slug += BASE62[byte % BASE62.length];
      if (slug.length === length) {
        return slug;
      }
    }
  }

  return slug;
}

export function hashPassword(password: string, salt?: string) {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, usedSalt, 120000, 32, 'sha256').toString('hex');
  return { salt: usedSalt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const hashed = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hashed, 'hex'), Buffer.from(hash, 'hex'));
}
