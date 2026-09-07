import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'

/**
 * Password hashing with node's built-in scrypt (memory-hard KDF); no external
 * dependency, same threat model as bcrypt. Stored format:
 *   scrypt:<salt-hex>:<hash-hex>
 * Parameters are node's defaults (N=16384, r=8, p=1, 64-byte key), taking ~50ms per
 * hash, which is the point: costly to brute-force, cheap to verify per login.
 */

const KEYLEN = 64

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEYLEN, (err, derived) => (err ? reject(err) : resolve(derived)))
  })
}

/** Hash a password for storage. Salted per-user; the format string binds the KDF. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt)
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`
}

/**
 * Verify a password against a stored `scrypt:` hash. Returns false (never
 * throws) for a malformed stored value. A corrupt row must not take the
 * login path down. The comparison uses timingSafeEqual.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[0-9a-f]{32}$/.test(parts[1]) || !/^[0-9a-f]+$/.test(parts[2])) {
    console.warn('[passwd] rejecting malformed stored hash')
    return false
  }
  const salt = Buffer.from(parts[1], 'hex')
  const expected = Buffer.from(parts[2], 'hex')
  const actual = await scrypt(password, salt)
  // Compare at the derived length so a tampered stored length can't crash us.
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
