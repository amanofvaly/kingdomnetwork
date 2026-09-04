import crypto from 'node:crypto';

// Crockford-ish: no I, O, 0 or 1, so a code read off a printed certificate and
// typed into the verification box cannot be mistyped into a different code.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const randomCode = (length) => {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
};

/** A short opaque id for things a person never types, like a lecture key. */
export const shortId = () => randomCode(10).toLowerCase();

/**
 * The same input always yields the same key. Seed content uses this so a
 * reseed does not orphan learner progress; anything authored in the admin
 * panel uses `shortId()` instead.
 */
export const stableKey = (seed) => {
  const digest = crypto.createHash('sha256').update(String(seed)).digest();
  let out = '';
  for (let i = 0; i < 10; i += 1) out += ALPHABET[digest[i] % ALPHABET.length];
  return out.toLowerCase();
};

export const reference = (prefix) => `${prefix}-${new Date().getFullYear()}-${randomCode(6)}`;

export const token = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
