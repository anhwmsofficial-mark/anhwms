import crypto from 'crypto';

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateSlug(length = 7) {
  const bytes = crypto.randomBytes(length);
  let slug = '';
  for (let i = 0; i < length; i += 1) {
    slug += BASE62[bytes[i] % BASE62.length];
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
