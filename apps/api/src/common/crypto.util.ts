import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const keyFor = (secret: string) => scryptSync(secret, 'valkyrie-secret-salt', 32);

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(payload: string, secret: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== 'v1') throw new Error('unknown secret payload');
  const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(':');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(plain, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}
