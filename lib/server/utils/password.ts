import crypto from "crypto";

// Password hashing uses scrypt from Node's built-in crypto module: a memory-hard
// KDF recommended by OWASP, with a unique random salt per password and no native
// dependency to compile. Hash format (self-describing so parameters can evolve):
//   scrypt$<N>$<r>$<p>$<saltHex>$<derivedHex>
const SCRYPT_LABEL = "scrypt";
const SCRYPT_N = 16384; // CPU/memory cost (2^14)
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

// Legacy format produced by the old client-side/server SHA-256 hashing. Still
// verified so existing users can log in, then transparently upgraded to scrypt.
const LEGACY_PREFIX = "sha256:";
const LEGACY_SALT = "agodly-ats:";

export interface PasswordVerification {
  valid: boolean;
  /** True when the stored hash used the legacy scheme and should be re-hashed. */
  needsUpgrade: boolean;
}

const normalize = (password: string): string => String(password ?? "");

export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(normalize(password), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
  return [
    SCRYPT_LABEL,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    derived.toString("hex")
  ].join("$");
};

export const isScryptHash = (storedHash: string): boolean =>
  String(storedHash || "").startsWith(`${SCRYPT_LABEL}$`);

export const verifyPassword = (password: string, storedHash: string): PasswordVerification => {
  const hash = String(storedHash || "").trim();
  if (!hash) return { valid: false, needsUpgrade: false };

  if (isScryptHash(hash)) {
    return { valid: verifyScrypt(normalize(password), hash), needsUpgrade: false };
  }

  if (hash.startsWith(LEGACY_PREFIX)) {
    return { valid: verifyLegacySha256(normalize(password), hash), needsUpgrade: true };
  }

  return { valid: false, needsUpgrade: false };
};

const verifyScrypt = (password: string, hash: string): boolean => {
  const parts = hash.split("$");
  if (parts.length !== 6) return false;

  const [, nRaw, rRaw, pRaw, saltHex, derivedHex] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (![N, r, p].every((value) => Number.isInteger(value) && value > 0)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(derivedHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = crypto.scryptSync(password, salt, expected.length, { N, r, p });
  return timingSafeEqual(derived, expected);
};

const verifyLegacySha256 = (password: string, hash: string): boolean => {
  const expectedHex = hash.slice(LEGACY_PREFIX.length);
  const actualHex = crypto.createHash("sha256").update(`${LEGACY_SALT}${password}`).digest("hex");
  return timingSafeEqual(Buffer.from(actualHex, "hex"), Buffer.from(expectedHex, "hex"));
};

export const timingSafeEqual = (left: Buffer, right: Buffer): boolean => {
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

export const timingSafeEqualStrings = (left: string, right: string): boolean =>
  timingSafeEqual(Buffer.from(String(left || ""), "utf8"), Buffer.from(String(right || ""), "utf8"));
